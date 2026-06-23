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

export function PriceChart({ repoId }: { repoId: string }) {
  const [interval, setInterval] = useState<Interval>("1m");

  const { data } = useQuery<Candle[]>({
    queryKey: ["candles", repoId, interval],
    queryFn: () =>
      fetch(`/api/market/${repoId}/candles?interval=${interval}`).then((r) =>
        r.json(),
      ),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  useSubscription<Candle>("candles", repoId, (c) => {
    candleRef.current?.update({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    });
    volRef.current?.update({
      time: c.time as UTCTimestamp,
      value: Number(c.volume) / 1e18,
      color: candleColor(c),
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
    if (!data) return;

    candleRef.current?.setData(
      data.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volRef.current?.setData(
      data.map((c) => ({
        time: c.time as UTCTimestamp,
        value: Number(c.volume) / 1e18,
        color: candleColor(c),
      })),
    );
  }, [data]);

  return (
    <div style={{ position: "relative", width: "100%", height: 420 }}>
      <div ref={containerRef} style={{ width: "100%", height: 420 }} />

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
