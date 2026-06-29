import type { FastifyInstance } from "fastify";
import { httpErrors } from "@fastify/sensible";
import { db } from "./db/db";

const INTERVAL_SECS = {
"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14_400, "1d": 86_400,
} as const;

type Interval = keyof typeof INTERVAL_SECS;

// (sqrtPriceX96 / 2^96)^2 scaled to a JS number safely
// - shift right by 32 bits to fit in 2*64 = 128 bits before squaring
// - leaves precision well within float64 for any realistic price
const SQRT_TO_PRICE_SQL = `
POW(CAST(sqrtPriceX96 AS REAL) / POW(2.0, 96), 2)
`;

export async function registerCandles(app: FastifyInstance) {
app.get<{
    Params: { repoId: string };
    Querystring: { interval?: Interval; from?: number; to?: number };
}>("/api/market/:repoId/candles", async (req) => {
    const interval = (req.query.interval ?? "1m") as Interval;
    const secs = INTERVAL_SECS[interval];
    if (!secs) throw httpErrors.badRequest("invalid interval");

    const from = req.query.from ?? 0;
    const to = req.query.to ?? Math.floor(Date.now() / 1000);

    // SQLite window aggregation: group on the floor(ts/secs)*secs bucket.
    return db.prepare(`
        WITH p AS (
            SELECT ts,
                block_number,
                log_index,
                (CAST(ts AS INTEGER) / ${secs}) * ${secs} AS bucket,
                ${SQRT_TO_PRICE_SQL} AS price,
                ABS(CAST(amount0 AS INTEGER)) AS vol
            FROM trades
            WHERE repo_id = ? AND ts BETWEEN ? AND ?
        ), w AS (
            SELECT bucket AS time,
                FIRST_VALUE(price)
                    OVER (PARTITION BY bucket ORDER BY ts, block_number, log_index
                        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
                    AS open,
                MAX(price) OVER (PARTITION BY bucket) AS high,
                MIN(price) OVER (PARTITION BY bucket) AS low,
                LAST_VALUE(price)
                    OVER (PARTITION BY bucket ORDER BY ts, block_number, log_index
                        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
                    AS close,
                SUM(vol) OVER (PARTITION BY bucket) AS volume
            FROM p
        )
        SELECT DISTINCT time, open, high, low, close, volume
        FROM w
        ORDER BY time ASC
    `).all(req.params.repoId, from, to);
});
}
