import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { chartColor } from './chartColors'
import { MARKET_LIVE_REFETCH_INTERVAL_MS, useSubscription } from './ws'

type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

const DEFAULT_INTERVAL: CandleInterval = '1h'
const DEFAULT_LOOKBACK_SECONDS = 60 * 60 * 24 * 45
const DEFAULT_TOKEN_DECIMALS = 18
const MAX_CANDLE_POINTS = 1_500
const PRICE_SCALE_MIN_WIDTH = 72

type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type PriceChartMarket = {
  repoId: string;
  baseTokenSymbol: string;
  quoteTokenSymbol: string;
  baseTokenDecimals?: number;
}

type PriceChartProps = {
  market: PriceChartMarket;
  interval?: CandleInterval;
}

type PriceChartState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; candles: MarketCandle[] }

const PRICE_FORMAT = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 })
const CHANGE_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const PERCENT_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseVolume(value: unknown): number | null {
  if (value == null) return 0

  const volume = typeof value === 'string' ? Number(value) : value
  if (!isFiniteNumber(volume) || volume < 0) return null

  return volume
}

function parseCandle(value: unknown): MarketCandle | null {
  if (!isRecord(value)) return null

  const volume = parseVolume(value.volume)
  if (
    !isFiniteNumber(value.time) ||
    !isFiniteNumber(value.open) ||
    !isFiniteNumber(value.high) ||
    !isFiniteNumber(value.low) ||
    !isFiniteNumber(value.close) ||
    volume == null
  ) return null

  return {
    time: value.time,
    open: value.open,
    high: value.high,
    low: value.low,
    close: value.close,
    volume,
  }
}

function parseCandlesResponse(value: unknown): MarketCandle[] {
  if (!Array.isArray(value)) throw new Error('invalid candles response')

  const candles = value.map(parseCandle)
  if (candles.some((candle) => candle == null)) throw new Error('invalid candles response')

  return candles.toSorted((left, right) => left!.time - right!.time) as MarketCandle[]
}

async function loadCandles(repoId: string, interval: CandleInterval, signal: AbortSignal): Promise<MarketCandle[]> {
  const params = new URLSearchParams({
    interval,
    from: String(Math.floor(Date.now() / 1000) - DEFAULT_LOOKBACK_SECONDS),
  })
  const response = await fetch(`/api/market/${encodeURIComponent(repoId)}/candles?${params}`, { signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseCandlesResponse(await response.json() as unknown).slice(-MAX_CANDLE_POINTS)
}

function mergeCandle(candles: MarketCandle[] | undefined, nextCandle: MarketCandle): MarketCandle[] {
  const nextCandles = candles ? [...candles] : []
  const existingIndex = nextCandles.findIndex((candle) => candle.time === nextCandle.time)

  if (existingIndex === -1) nextCandles.push(nextCandle)
  else nextCandles[existingIndex] = nextCandle

  return nextCandles.toSorted((left, right) => left.time - right.time).slice(-MAX_CANDLE_POINTS)
}

function stateFromQuery(candles: MarketCandle[] | undefined, status: 'error' | 'pending' | 'success', error: Error | null): PriceChartState {
  if (candles && candles.length > 0) return { status: 'ready', candles }
  if (status === 'pending') return { status: 'loading' }
  if (status === 'error') return { status: 'error', message: error?.message ?? 'Unable to load price history' }

  return { status: 'empty' }
}

function formatPrice(value: number) {
  return Number.isFinite(value) ? PRICE_FORMAT.format(value) : '-'
}

function formatChartPrice(value: number) {
  const absolute = Math.abs(value)
  if (!Number.isFinite(value)) return '-'
  if (absolute >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (absolute >= 1) return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return PRICE_FORMAT.format(value)
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return '-'

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${CHANGE_FORMAT.format(value)}`
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '-'

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${PERCENT_FORMAT.format(value)}%`
}

function normalizedVolume(candle: MarketCandle, decimals: number) {
  return candle.volume / 10 ** decimals
}

function toCandlestickData(candle: MarketCandle) {
  return {
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

function toVolumeData(candle: MarketCandle, decimals: number, upColor: string, downColor: string) {
  return {
    time: candle.time as UTCTimestamp,
    value: normalizedVolume(candle, decimals),
    color: candle.close >= candle.open ? upColor : downColor,
  }
}

function PriceChartLegend({ market, interval, state }: { market: PriceChartMarket; interval: CandleInterval; state: PriceChartState }) {
  const candle = state.status === 'ready' ? state.candles.at(-1) : null
  const previous = state.status === 'ready' ? state.candles.at(-2) : null
  const change = candle && previous ? candle.close - previous.close : null
  const changePercent = candle && previous && previous.close !== 0 ? (change ?? 0) / previous.close * 100 : null
  const move = change == null ? 'flat' : change >= 0 ? 'up' : 'down'

  return (
    <div className="price-chart__legend" aria-live="polite">
      <span className="price-chart__market">
        <span>{market.baseTokenSymbol}/{market.quoteTokenSymbol}</span>
        <span>{interval}</span>
        <span>Registry market</span>
      </span>
      {candle ? (
        <dl className={`price-chart__ohlc price-chart__ohlc--${move}`}>
          <div><dt>O</dt><dd>{formatPrice(candle.open)}</dd></div>
          <div><dt>H</dt><dd>{formatPrice(candle.high)}</dd></div>
          <div><dt>L</dt><dd>{formatPrice(candle.low)}</dd></div>
          <div><dt>C</dt><dd>{formatPrice(candle.close)}</dd></div>
          {change != null && changePercent != null && (
            <div className="price-chart__change">
              <dt>CHG</dt>
              <dd>{formatSigned(change)} ({formatSignedPercent(changePercent)})</dd>
            </div>
          )}
        </dl>
      ) : (
        <span className="price-chart__muted">Waiting for candles</span>
      )}
    </div>
  )
}

function PriceChartStatus({ state }: { state: PriceChartState }) {
  if (state.status === 'ready') return null

  const role = state.status === 'error' ? 'alert' : 'status'
  const label = state.status === 'loading'
    ? 'Loading price history...'
    : state.status === 'error'
      ? state.message
      : 'No candles available.'

  return (
    <div className={`price-chart__status price-chart__status--${state.status}`} role={role}>
      <span>{label}</span>
    </div>
  )
}

export function PriceChart({ market, interval = DEFAULT_INTERVAL }: PriceChartProps) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const fittedDataKeyRef = useRef<string | null>(null)
  const chartColorsRef = useRef({
    up: '#00d6b4',
    down: '#ff4d57',
    volumeUp: 'rgba(0, 214, 180, 0.36)',
    volumeDown: 'rgba(255, 77, 87, 0.36)',
  })
  const decimals = market.baseTokenDecimals ?? DEFAULT_TOKEN_DECIMALS
  const candleQueryKey = ['candles', market.repoId, interval] as const
  const candlesQuery = useQuery({
    queryKey: candleQueryKey,
    queryFn: ({ signal }) => loadCandles(market.repoId, interval, signal),
    refetchInterval: MARKET_LIVE_REFETCH_INTERVAL_MS,
  })
  const state = stateFromQuery(candlesQuery.data, candlesQuery.status, candlesQuery.error)

  useSubscription<unknown>('candles', market.repoId, (payload) => {
    const candle = parseCandle(payload)
    if (!candle) return

    queryClient.setQueryData<MarketCandle[]>(candleQueryKey, (current) => mergeCandle(current, candle))
  }, interval)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const up = chartColor(container, '--chart-up', '#00d6b4')
    const down = chartColor(container, '--chart-down', '#ff4d57')
    const volumeUp = chartColor(container, '--chart-volume-up', 'rgba(0, 214, 180, 0.36)')
    const volumeDown = chartColor(container, '--chart-volume-down', 'rgba(255, 77, 87, 0.36)')
    const background = chartColor(container, '--chart-bg', '#071113')
    const grid = chartColor(container, '--chart-grid', 'rgba(122, 143, 151, 0.16)')
    const text = chartColor(container, '--chart-text', '#aeb8c2')
    const crosshair = chartColor(container, '--chart-crosshair', 'rgba(204, 216, 224, 0.56)')

    chartColorsRef.current = { up, down, volumeUp, volumeDown }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: background },
        textColor: text,
        fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
        attributionLogo: true,
        panes: {
          separatorColor: grid,
          separatorHoverColor: grid,
          enableResize: false,
        },
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: {
        visible: true,
        alignLabels: true,
        entireTextOnly: true,
        borderColor: grid,
        minimumWidth: PRICE_SCALE_MIN_WIDTH,
        scaleMargins: { top: 0.14, bottom: 0.08 },
        tickMarkDensity: 3,
      },
      timeScale: {
        borderColor: grid,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 5,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: background },
        horzLine: { color: crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: background },
      },
      localization: {
        priceFormatter: formatChartPrice,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
      priceLineColor: down,
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
      lastValueVisible: true,
    })
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: volumeDown,
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1)

    chart.panes()[1]?.setHeight(84)

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return

      chart.resize(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height))
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const candles = candlesQuery.data ?? []
    const lastCandle = candles.at(-1)
    const colors = chartColorsRef.current

    candleSeriesRef.current?.setData(candles.map(toCandlestickData))
    candleSeriesRef.current?.applyOptions({ priceLineColor: lastCandle && lastCandle.close >= lastCandle.open ? colors.up : colors.down })
    volumeSeriesRef.current?.setData(candles.map((candle) => toVolumeData(candle, decimals, colors.volumeUp, colors.volumeDown)))

    if (!lastCandle) return

    const fitKey = `${market.repoId}:${interval}`
    if (fittedDataKeyRef.current === fitKey) return

    chartRef.current?.timeScale().fitContent()
    fittedDataKeyRef.current = fitKey
  }, [candlesQuery.data, decimals, interval, market.repoId])

  return (
    <section className="price-chart" aria-label={`${market.baseTokenSymbol}/${market.quoteTokenSymbol} price chart`}>
      <div className="price-chart__surface">
        <div ref={containerRef} className="price-chart__canvas" />
        <PriceChartLegend market={market} interval={interval} state={state} />
        <PriceChartStatus state={state} />
      </div>
    </section>
  )
}
