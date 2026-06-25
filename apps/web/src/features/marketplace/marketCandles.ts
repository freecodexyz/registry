import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { EthUsdPriceState } from './marketPrice'
import { tokensPerWethToUsdPrice } from './marketNumbers'
import { MARKET_LIVE_REFETCH_INTERVAL_MS, useSubscription } from './ws'

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export const DEFAULT_CANDLE_INTERVAL: CandleInterval = '1h'
export const DEFAULT_CHART_LOOKBACK_SECONDS = 60 * 60 * 24 * 45
export const MARKET_DAY_LOOKBACK_SECONDS = 60 * 60 * 24
export const MAX_CANDLE_POINTS = 1_500

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketCandleState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; candles: MarketCandle[] }

type UseMarketCandlesParams = {
  repoId: string;
  interval: CandleInterval;
  lookbackSeconds: number;
}

type MarketCandlesResult = {
  rawCandles: MarketCandle[] | undefined;
  state: MarketCandleState;
}

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

export function parseMarketCandle(value: unknown): MarketCandle | null {
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

export function parseMarketCandlesResponse(value: unknown): MarketCandle[] {
  if (!Array.isArray(value)) throw new Error('invalid candles response')

  const candles: MarketCandle[] = []
  for (const item of value) {
    const candle = parseMarketCandle(item)
    if (!candle) throw new Error('invalid candles response')

    candles.push(candle)
  }

  return candles.toSorted((left, right) => left.time - right.time)
}

export function marketCandlesQueryKey(repoId: string, interval: CandleInterval, lookbackSeconds: number) {
  return ['candles', repoId, interval, lookbackSeconds] as const
}

export async function loadMarketCandles(repoId: string, interval: CandleInterval, lookbackSeconds: number, signal: AbortSignal): Promise<MarketCandle[]> {
  const params = new URLSearchParams({
    interval,
    from: String(Math.floor(Date.now() / 1000) - lookbackSeconds),
  })
  const response = await fetch(`/api/market/${encodeURIComponent(repoId)}/candles?${params}`, { signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseMarketCandlesResponse(await response.json() as unknown).slice(-MAX_CANDLE_POINTS)
}

export function mergeMarketCandle(candles: MarketCandle[] | undefined, nextCandle: MarketCandle): MarketCandle[] {
  const nextCandles = candles ? [...candles] : []
  const existingIndex = nextCandles.findIndex((candle) => candle.time === nextCandle.time)

  if (existingIndex === -1) nextCandles.push(nextCandle)
  else nextCandles[existingIndex] = nextCandle

  return nextCandles.toSorted((left, right) => left.time - right.time).slice(-MAX_CANDLE_POINTS)
}

export function stateFromMarketCandlesQuery(candles: MarketCandle[] | undefined, status: 'error' | 'pending' | 'success', error: Error | null): MarketCandleState {
  if (candles && candles.length > 0) return { status: 'ready', candles }
  if (status === 'pending') return { status: 'loading' }
  if (status === 'error') return { status: 'error', message: error?.message ?? 'Unable to load price history' }

  return { status: 'empty' }
}

export function toUsdCandle(candle: MarketCandle, wethUsdPrice: number): MarketCandle | null {
  const open = tokensPerWethToUsdPrice(candle.open, wethUsdPrice)
  const high = tokensPerWethToUsdPrice(candle.high, wethUsdPrice)
  const low = tokensPerWethToUsdPrice(candle.low, wethUsdPrice)
  const close = tokensPerWethToUsdPrice(candle.close, wethUsdPrice)

  if (open == null || high == null || low == null || close == null) return null

  return { ...candle, open, high, low, close }
}

export function toUsdCandles(candles: MarketCandle[], wethUsdPrice: number): MarketCandle[] | null {
  const usdCandles: MarketCandle[] = []
  for (const candle of candles) {
    const usdCandle = toUsdCandle(candle, wethUsdPrice)
    if (!usdCandle) return null

    usdCandles.push(usdCandle)
  }

  return usdCandles
}

export function stateFromUsdConversion(candleState: MarketCandleState, ethUsdPriceState: EthUsdPriceState): MarketCandleState {
  if (candleState.status !== 'ready') return candleState
  if (ethUsdPriceState.status !== 'ready') return { status: 'empty' }

  const candles = toUsdCandles(candleState.candles, ethUsdPriceState.usdPrice)
  if (!candles) return { status: 'error', message: 'Unable to convert price history to USD' }
  if (candles.length === 0) return { status: 'empty' }

  return { status: 'ready', candles }
}

export function useMarketCandles({ repoId, interval, lookbackSeconds }: UseMarketCandlesParams): MarketCandlesResult {
  const queryClient = useQueryClient()
  const candleQueryKey = marketCandlesQueryKey(repoId, interval, lookbackSeconds)
  const candlesQuery = useQuery({
    queryKey: candleQueryKey,
    queryFn: ({ signal }) => loadMarketCandles(repoId, interval, lookbackSeconds, signal),
    refetchInterval: MARKET_LIVE_REFETCH_INTERVAL_MS,
  })

  useSubscription<unknown>('candles', repoId, (payload) => {
    const candle = parseMarketCandle(payload)
    if (!candle) return

    queryClient.setQueryData<MarketCandle[]>(candleQueryKey, (current) => mergeMarketCandle(current, candle))
  }, interval)

  return {
    rawCandles: candlesQuery.data,
    state: stateFromMarketCandlesQuery(candlesQuery.data, candlesQuery.status, candlesQuery.error),
  }
}
