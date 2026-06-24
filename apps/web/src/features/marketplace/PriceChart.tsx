import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Notice } from "@freecodexyz/ui";
import { useSubscription } from "./ws";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

type Interval = (typeof INTERVALS)[number];
type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | string;
};

function candleColor(c: Candle) {
  return c.close >= c.open ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)";
}

function isCandle(value: unknown): value is Candle {
  return typeof value === "object" &&
    value !== null &&
    "time" in value &&
    "open" in value &&
    "high" in value &&
    "low" in value &&
    "close" in value &&
    "volume" in value &&
    typeof value.time === "number" &&
    typeof value.open === "number" &&
    typeof value.high === "number" &&
    typeof value.low === "number" &&
    typeof value.close === "number" &&
    (typeof value.volume === "number" || typeof value.volume === "string");
}

async function loadCandles(repoId: string, interval: Interval, signal: AbortSignal): Promise<Candle[]> {
  const response = await fetch(`/api/market/${repoId}/candles?interval=${interval}`, { signal });
  if (!response.ok) throw new Error(`API returned ${response.status}`);

  const data = await response.json() as unknown;
  if (Array.isArray(data) && data.every(isCandle)) return data;

  throw new Error("invalid candle response");
}

export function PriceChart({ repoId }: { repoId: string }) {
  const [interval, setInterval] = useState<Interval>("1m");

  const candlesQuery = useQuery({
    queryKey: ["candles", repoId, interval],
    queryFn: ({ signal }) => loadCandles(repoId, interval, signal),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useSubscription<unknown>("candles", repoId, (payload) => {
    if (!isCandle(payload)) return;

    candleRef.current?.update({
      time: payload.time as UTCTimestamp,
      open: payload.open,
      high: payload.high,
      low: payload.low,
      close: payload.close,
    });
    volRef.current?.update({
      time: payload.time as UTCTimestamp,
      value: Number(payload.volume) / 1e18,
      color: candleColor(payload),
    });
  }, interval);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: {
          type: ColorType.Solid,
          color: "#0d1117",
        },
        textColor: "#c9d1d9",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#161b22" },
        horzLines: { color: "#161b22" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#30363d",
      },
      rightPriceScale: {
        borderColor: "#30363d",
        scaleMargins: {
          top: 0.05,
          bottom: 0.25,
        },
      },
    });

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    volRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "#3a3f47",
    });

    chart.priceScale("vol").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const ro = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: entry.contentRect.width,
      });
    });

    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candlesQuery.data) return;

    candleRef.current?.setData(
      candlesQuery.data.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volRef.current?.setData(
      candlesQuery.data.map((c) => ({
        time: c.time as UTCTimestamp,
        value: Number(c.volume) / 1e18,
        color: candleColor(c),
      })),
    );
  }, [candlesQuery.data]);

  const errorMessage = candlesQuery.error instanceof Error ? candlesQuery.error.message : "Unable to load candles";

  return (
    <div style={{ position: "relative", width: "100%", height: 420 }}>
      <div ref={containerRef} style={{ width: "100%", height: 420 }} />

      {candlesQuery.status === "pending" && <Notice>Loading candles...</Notice>}
      {candlesQuery.status === "error" && <Notice tone="danger" role="alert">{errorMessage}</Notice>}
      {candlesQuery.status === "success" && candlesQuery.data.length === 0 && <Notice>No candles available.</Notice>}

      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          gap: 4,
        }}
      >
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            data-active={iv === interval}
          >
            {iv}
          </button>
        ))}
      </div>
    </div>
  );
}
