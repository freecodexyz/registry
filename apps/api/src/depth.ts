import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { stateViewAbi } from "./abi/stateView";
import { STATE_VIEW, RPC_URL } from "./addresses";

const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
    batch: { multicall: true },
});
const Q96 = 2n ** 96n;

const tickToPrice = (tick: number) => Math.pow(1.0001, tick);
const sqrtRatioAtTick = (tick: number) => BigInt(Math.floor(Math.sqrt(tickToPrice(tick)) * Number(Q96)));

// Liquidity -> amount0 between sqrtA, sqrtB (V3 math, unchanged in V4 cores).
type DepthLevel = { price: number; size: bigint; cumulative: bigint };

function amount0Between(sqrtA: bigint, sqrtB: bigint, L: bigint) {
    const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
    return (L * Q96 * (hi - lo)) / hi / lo;
}

function amount1Between(sqrtA: bigint, sqrtB: bigint, L: bigint) {
    const [lo, hi] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA];
    return (L * (hi - lo)) / Q96;
}

export async function buildBook(poolId: `0x${string}`, tickSpacing: number, halfDepth: number = 30) {
    // 1) current state.
    const [s0, liq] = await client.multicall({
        contracts: [
            { address: STATE_VIEW, abi: stateViewAbi, functionName: "getSlot0", args: [poolId] },
            { address: STATE_VIEW, abi: stateViewAbi, functionName: "getLiquidity", args: [poolId] },
        ],
        allowFailure: false,
    });
    const tick = (s0 as readonly [bigint, number, number, number])[1];

    // 2) enumerate ticks within +-halfDepth tickSpacings using the bitmap.
    const compressed = Math.floor(tick / tickSpacing);
    const wordOf = (compressed: number) => compressed >> 8;
    const bits = (n: bigint) => {
        const out: number[] = [];
        for (let i = 0; i < 256; i++) if ((n >> BigInt(i)) & 1n) out.push(i);
        return out;
    };
    const wordRange = Array.from(
        { length: 2 * Math.ceil(halfDepth / 256) + 1 },
        (_, k) => wordOf(compressed) - (k - 1),
    );
    const words = await client.multicall({
        contracts: wordRange.map((w) => ({
            address: STATE_VIEW,
            abi: stateViewAbi,
            functionName: "getTickBitmap",
            args: [poolId, w],
        })),
        allowFailure: false,
    });
    const initializedTicks = words
        .flatMap((w, i) => bits(w as bigint).map((b) => (wordRange[i]! * 256 + b) * tickSpacing))
        .sort((a, b) => a - b);

    // 3) batch-fetch liquidityNet at each tick.
    const tickLiq = await client.multicall({
        contracts: initializedTicks.map((t) => ({
            address: STATE_VIEW,
            abi: stateViewAbi,
            functionName: "getTickLiquidity",
            args: [poolId, t],
        })),
        allowFailure: false,
    });

    // 4) walk left from current tick to build bids, right to build asks.
    const asks: DepthLevel[] = [];
    const bids: DepthLevel[] = [];
    let L = liq as bigint;
    let prevSqrt = (s0 as readonly [bigint, number, number, number])[0];
    let cumulative = 0n;

    // ASKS: token0 -> token1 direction; tick increases.
    for (let i = 0; i < initializedTicks.length; i++) {
        const t = initializedTicks[i]!;
        if (t <= tick) continue;
        const nextSqrt = sqrtRatioAtTick(t);
        const size = amount0Between(prevSqrt, nextSqrt, L);
        cumulative += size;
        asks.push({ price: tickToPrice(t), size, cumulative });
        L += (tickLiq[i] as readonly [bigint, bigint])[1];
        prevSqrt = nextSqrt;
        if (asks.length >= halfDepth) break;
    }

    L = liq as bigint;
    prevSqrt = (s0 as readonly [bigint, number, number, number])[0];
    cumulative = 0n;
    for (let i = initializedTicks.length - 1; i >= 0; i--) {
        const t = initializedTicks[i]!;
        if (t > tick) continue;
        const nextSqrt = sqrtRatioAtTick(t);
        const size = amount1Between(nextSqrt, prevSqrt, L);
        cumulative += size;
        bids.push({ price: tickToPrice(t), size, cumulative });
        L -= (tickLiq[i] as readonly [bigint, bigint])[1];
        prevSqrt = nextSqrt;
        if (bids.length >= halfDepth) break;
    }

    return {
        tick,
        sqrtPriceX96: (s0 as readonly [bigint, number, number, number])[0].toString(),
        bids: bids.map(toStr),
        asks: asks.map(toStr),
    };
}

const toStr = ({ price, size, cumulative }: DepthLevel) => ({
    price,
    size: size.toString(),
    cumulative: cumulative.toString(),
});
