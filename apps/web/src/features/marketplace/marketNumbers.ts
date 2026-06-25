import { formatUnits } from 'viem'
import type { EthUsdPriceState } from './marketPrice'
import type { MarketCandle } from './marketCandles'

export const DEFAULT_TOKEN_DECIMALS = 18

export type MarketMove = 'up' | 'down' | 'flat'

export type PriceMovement = {
  latestPrice: number;
  rawChange: number;
  percentChange: number | null;
}

const USD_PRICE_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 8 })
const USD_CHANGE_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 })
const USD_COMPACT_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
const USD_FULL_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const COMPACT_PRECISE_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const COMPACT_RULER_FORMATS = Array.from({ length: 7 }, (_, maximumFractionDigits) => new Intl.NumberFormat('en-US', { maximumFractionDigits }))
const TOKEN_FIXED_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const TRADE_SIZE_FORMAT = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 })
const TOKEN_DISPLAY_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const TOKEN_DISPLAY_SMALL_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const PERCENT_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const SPREAD_PERCENT_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function safePositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function bpsToRate(bps: number) {
  return Number.isFinite(bps) && bps > 0 ? bps / 10_000 : 0
}

export function formatBpsPercent(bps: number) {
  return (safePositiveNumber(bps) / 100).toFixed(2)
}

export function tokensPerWethToUsdPrice(tokensPerWeth: number, wethUsdPrice: number): number | null {
  if (!Number.isFinite(tokensPerWeth) || tokensPerWeth <= 0) return null
  if (!Number.isFinite(wethUsdPrice) || wethUsdPrice < 0) return null

  return wethUsdPrice / tokensPerWeth
}

export function sqrtPriceX96ToTokenPrice(value: string): number | null {
  const sqrtPriceX96 = Number(value)
  if (!Number.isFinite(sqrtPriceX96) || sqrtPriceX96 <= 0) return null

  const sqrtPrice = sqrtPriceX96 / 2 ** 96
  return sqrtPrice * sqrtPrice
}

export function tokenAmountFromBaseUnits(value: string | bigint, decimals: number): number | null {
  try {
    const amount = typeof value === 'bigint' ? value : BigInt(value)
    const parsed = Number(formatUnits(amount, decimals))

    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function formatUsdPrice(value: number) {
  return Number.isFinite(value) ? USD_PRICE_FORMAT.format(value) : '-'
}

export function formatChartUsdPrice(value: number) {
  const absolute = Math.abs(value)
  if (!Number.isFinite(value)) return '-'
  if (absolute >= 1000) return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  if (absolute >= 1) return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 })

  return USD_PRICE_FORMAT.format(value)
}

export function formatMarketCapUsd(value: number) {
  return Number.isFinite(value) ? USD_FULL_FORMAT.format(value) : '-'
}

function formatCompactMarketCap(value: number, formatter: Intl.NumberFormat) {
  if (!Number.isFinite(value)) return '-'

  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (absolute >= 1_000_000_000) return `${sign}${formatter.format(absolute / 1_000_000_000)}b`
  if (absolute >= 1_000_000) return `${sign}${formatter.format(absolute / 1_000_000)}m`
  if (absolute >= 1_000) return `${sign}${formatter.format(absolute / 1_000)}k`

  return `${sign}${formatter.format(absolute)}`
}

function hasDuplicateLabels(labels: readonly string[]) {
  return new Set(labels).size !== labels.length
}

function withoutDuplicateLabels(labels: readonly string[]) {
  const seen = new Set<string>()

  return labels.map((label) => {
    if (!seen.has(label)) {
      seen.add(label)
      return label
    }

    return ''
  })
}

export function formatMarketCapRulerValues(values: readonly number[]) {
  for (const formatter of COMPACT_RULER_FORMATS) {
    const labels = values.map((value) => formatCompactMarketCap(value, formatter))
    if (!hasDuplicateLabels(labels)) return labels
  }

  const preciseLabels = values.map(formatMarketCapPointerValue)
  return hasDuplicateLabels(preciseLabels) ? withoutDuplicateLabels(preciseLabels) : preciseLabels
}

export function formatMarketCapPointerValue(value: number) {
  return formatCompactMarketCap(value, COMPACT_PRECISE_FORMAT)
}

export function formatCompactUsd(value: number) {
  return Number.isFinite(value) && value >= 0 ? USD_COMPACT_FORMAT.format(value) : '-'
}

export function formatSignedUsdChange(value: number) {
  if (!Number.isFinite(value)) return '-'

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${USD_CHANGE_FORMAT.format(value)}`
}

export function formatSignedPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${PERCENT_FORMAT.format(value)}%`
}

export function formatSpreadPercent(value: number | null) {
  return value == null || !Number.isFinite(value) ? '-' : `${SPREAD_PERCENT_FORMAT.format(value)}%`
}

export function formatTokensPerWethUsdPrice(tokensPerWeth: number, ethUsdPriceState: EthUsdPriceState) {
  if (ethUsdPriceState.status !== 'ready') return '-'

  const usdPrice = tokensPerWethToUsdPrice(tokensPerWeth, ethUsdPriceState.usdPrice)
  return usdPrice == null ? '-' : formatUsdPrice(usdPrice)
}

export function formatBookTokenAmount(value: string, decimals: number) {
  const amount = tokenAmountFromBaseUnits(value, decimals)
  return amount == null ? '-' : TOKEN_FIXED_FORMAT.format(amount)
}

export function formatTradeSize(value: string, decimals: number) {
  const amount = tokenAmountFromBaseUnits(value, decimals)
  return amount == null ? value : TRADE_SIZE_FORMAT.format(amount)
}

export function formatDisplayTokenAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const formatter = safeAmount > 0 && safeAmount < 1 ? TOKEN_DISPLAY_SMALL_FORMAT : TOKEN_DISPLAY_FORMAT

  return formatter.format(safeAmount)
}

export function priceMovement(latestPrice: number, previousPrice: number): PriceMovement | null {
  if (!Number.isFinite(latestPrice) || !Number.isFinite(previousPrice)) return null

  const rawChange = latestPrice - previousPrice
  const percentChange = previousPrice > 0 ? rawChange / previousPrice * 100 : null

  return { latestPrice, rawChange, percentChange }
}

export function priceMovementFromCandles(candles: readonly MarketCandle[]): PriceMovement | null {
  const firstCandle = candles[0]
  const latestCandle = candles.at(-1)
  if (!firstCandle || !latestCandle) return null

  return priceMovement(latestCandle.close, firstCandle.open)
}

export function movementFromChange(value: number): MarketMove {
  if (value > 0) return 'up'
  if (value < 0) return 'down'

  return 'flat'
}

export function normalizedTokenVolume(volume: number, decimals: number): number | null {
  const divisor = 10 ** decimals
  if (!Number.isFinite(volume) || volume < 0 || !Number.isFinite(divisor) || divisor <= 0) return null

  return volume / divisor
}

export function candleVolumeUsd(candles: readonly MarketCandle[], tokenDecimals: number): number | null {
  let total = 0

  for (const candle of candles) {
    const normalizedVolume = normalizedTokenVolume(candle.volume, tokenDecimals)
    if (normalizedVolume == null || !Number.isFinite(candle.close)) return null

    total += normalizedVolume * candle.close
  }

  return Number.isFinite(total) ? total : null
}

export function marketCapUsd(totalSupply: bigint, tokenDecimals: number, latestPrice: number): number | null {
  const supply = tokenAmountFromBaseUnits(totalSupply, tokenDecimals)
  if (supply == null || supply < 0 || !Number.isFinite(latestPrice) || latestPrice < 0) return null

  const marketCap = supply * latestPrice
  return Number.isFinite(marketCap) && marketCap >= 0 ? marketCap : null
}

export function priceSpread(bestBid: number | undefined, bestAsk: number | undefined): number | null {
  if (bestBid == null || bestAsk == null) return null
  if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) return null

  return Math.max(0, bestAsk - bestBid)
}

export function priceSpreadPercent(bestBid: number | undefined, bestAsk: number | undefined): number | null {
  const spread = priceSpread(bestBid, bestAsk)
  if (spread == null || bestBid == null || bestAsk == null) return null

  const mid = (bestBid + bestAsk) / 2
  if (!Number.isFinite(mid) || mid <= 0) return null

  return spread / mid * 100
}
