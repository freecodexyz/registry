import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Notice } from '@freecodexyz/ui'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { formatUnits } from 'viem'
import { explorerTxUrl } from '../../shared/explorers'
import { useSubscription } from './ws'

const DEFAULT_TRADE_LIMIT = 5_000
const DEFAULT_LIST_HEIGHT = 360
const TRADE_ROW_HEIGHT = 34
const PRICE_FORMAT = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 })
const SIZE_FORMAT = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 8 })

type TradeSide = 'buy' | 'sell'

type Trade = {
  id: string;
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: number;
  ts: number;
  price: number;
  size: string;
  side: TradeSide;
}

export type TradeFeedMarket = {
  repoId: string;
  baseTokenSymbol: string;
  baseTokenDecimals?: number;
  chainId: number;
}

type TradeFeedProps = {
  market: TradeFeedMarket;
  limit?: number;
  height?: number;
}

type ApiTradePayload = {
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: number;
  ts: number;
  price: number;
  size: string;
  side: TradeSide;
}

type LiveTradePayload = {
  txHash: `0x${string}`;
  logIndex: number;
  blockNumber: number;
  ts: number;
  amount0: string;
  amount1: string;
  sqrtPriceX96: string;
}

type TradeFeedRowProps = {
  trades: Trade[];
  chainId: number;
  baseTokenDecimals: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && value.startsWith('0x')
}

function isTradeSide(value: unknown): value is TradeSide {
  return value === 'buy' || value === 'sell'
}

function isApiTradePayload(value: unknown): value is ApiTradePayload {
  return isRecord(value) &&
    isHexString(value.txHash) &&
    typeof value.logIndex === 'number' &&
    typeof value.blockNumber === 'number' &&
    typeof value.ts === 'number' &&
    typeof value.price === 'number' &&
    typeof value.size === 'string' &&
    isTradeSide(value.side)
}

function isLiveTradePayload(value: unknown): value is LiveTradePayload {
  return isRecord(value) &&
    isHexString(value.txHash) &&
    typeof value.logIndex === 'number' &&
    typeof value.blockNumber === 'number' &&
    typeof value.ts === 'number' &&
    typeof value.amount0 === 'string' &&
    typeof value.amount1 === 'string' &&
    typeof value.sqrtPriceX96 === 'string'
}

function tradeId(txHash: string, logIndex: number) {
  return `${txHash}:${logIndex}`
}

function apiTradeToTrade(payload: ApiTradePayload): Trade {
  return {
    id: tradeId(payload.txHash, payload.logIndex),
    txHash: payload.txHash,
    logIndex: payload.logIndex,
    blockNumber: payload.blockNumber,
    ts: payload.ts,
    price: payload.price,
    size: payload.size,
    side: payload.side,
  }
}

function parseTradeHistory(value: unknown): Trade[] {
  if (Array.isArray(value) && value.every(isApiTradePayload)) return value.map(apiTradeToTrade)

  throw new Error('invalid trades response')
}

function absoluteBigIntString(value: string): string | null {
  try {
    const amount = BigInt(value)
    return (amount < 0n ? -amount : amount).toString()
  } catch {
    return null
  }
}

function sideFromAmount0(value: string): TradeSide | null {
  try {
    return BigInt(value) < 0n ? 'buy' : 'sell'
  } catch {
    return null
  }
}

function priceFromSqrtPriceX96(value: string): number | null {
  const sqrtPriceX96 = Number(value)
  if (!Number.isFinite(sqrtPriceX96) || sqrtPriceX96 <= 0) return null

  const sqrtPrice = sqrtPriceX96 / 2 ** 96
  return sqrtPrice * sqrtPrice
}

function parseLiveTrade(value: unknown): Trade | null {
  if (!isLiveTradePayload(value)) return null

  const size = absoluteBigIntString(value.amount1)
  const side = sideFromAmount0(value.amount0)
  const price = priceFromSqrtPriceX96(value.sqrtPriceX96)
  if (!size || !side || price == null) return null

  return {
    id: tradeId(value.txHash, value.logIndex),
    txHash: value.txHash,
    logIndex: value.logIndex,
    blockNumber: value.blockNumber,
    ts: value.ts,
    price,
    size,
    side,
  }
}

async function loadTrades(repoId: string, limit: number, signal: AbortSignal): Promise<Trade[]> {
  const response = await fetch(`/api/market/${encodeURIComponent(repoId)}/trades?limit=${limit}`, { signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseTradeHistory(await response.json() as unknown)
}

function compareTrades(left: Trade, right: Trade) {
  if (left.blockNumber !== right.blockNumber) return right.blockNumber - left.blockNumber
  return right.logIndex - left.logIndex
}

function mergeTrade(current: Trade[] | undefined, trade: Trade, limit: number): Trade[] {
  const trades = current ?? []
  if (trades.some((item) => item.id === trade.id)) return trades

  return [trade, ...trades].toSorted(compareTrades).slice(0, limit)
}

function twoDigits(value: number) {
  return String(value).padStart(2, '0')
}

function formatTradeTime(timestamp: number) {
  const date = new Date(timestamp * 1000)

  return {
    hours: twoDigits(date.getHours()),
    minutes: twoDigits(date.getMinutes()),
    seconds: twoDigits(date.getSeconds()),
    iso: date.toISOString(),
  }
}

function formatPrice(price: number) {
  return Number.isFinite(price) ? PRICE_FORMAT.format(price) : '-'
}

function formatSize(size: string, decimals: number) {
  try {
    const amount = Number(formatUnits(BigInt(size), decimals))
    return Number.isFinite(amount) ? SIZE_FORMAT.format(amount) : size
  } catch {
    return size
  }
}

function TradeFeedRow({ index, style, ariaAttributes, trades, chainId, baseTokenDecimals }: RowComponentProps<TradeFeedRowProps>) {
  const trade = trades[index]
  if (!trade) return null

  const price = formatPrice(trade.price)
  const sideLabel = trade.side === 'buy' ? 'BUY' : 'SELL'
  const time = formatTradeTime(trade.ts)

  return (
    <div {...ariaAttributes} className="trade-feed__row" style={style}>
      <span className={`trade-feed__cell trade-feed__number trade-feed__price trade-feed__price--${trade.side}`} aria-label={`${sideLabel} price ${price}`}>
        {price}
      </span>
      <span className="trade-feed__cell trade-feed__number">{formatSize(trade.size, baseTokenDecimals)}</span>
      <span className="trade-feed__cell trade-feed__time">
        <time dateTime={time.iso}>
          <span className="trade-feed__number">{time.hours}</span>
          <span>:</span>
          <span className="trade-feed__number">{time.minutes}</span>
          <span>:</span>
          <span className="trade-feed__number">{time.seconds}</span>
        </time>
        <a className="trade-feed__tx-link" href={explorerTxUrl(chainId, trade.txHash)} target="_blank" rel="noreferrer" aria-label={`Open ${sideLabel} transaction on Base Sepolia explorer`}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M6 4v1.5h6.44L4.97 12.97l1.06 1.06 7.47-7.47V13H15V4H6Z" />
            <path d="M4.5 5.5H8V7H6v7h7v-2h1.5v3.5h-10v-10Z" />
          </svg>
        </a>
      </span>
    </div>
  )
}

export function TradeFeed({ market, limit = DEFAULT_TRADE_LIMIT, height = DEFAULT_LIST_HEIGHT }: TradeFeedProps) {
  const queryClient = useQueryClient()
  const tradeQueryKey = ['trades', market.repoId, limit] as const
  const baseTokenDecimals = market.baseTokenDecimals ?? 18
  const tradesQuery = useQuery({
    queryKey: tradeQueryKey,
    queryFn: ({ signal }) => loadTrades(market.repoId, limit, signal),
  })

  useSubscription<unknown>('trades', market.repoId, (payload) => {
    const trade = parseLiveTrade(payload)
    if (!trade) return

    queryClient.setQueryData<Trade[]>(tradeQueryKey, (current) => mergeTrade(current, trade, limit))
  })

  const trades = tradesQuery.data ?? []
  const hasRows = trades.length > 0
  const errorMessage = tradesQuery.error instanceof Error ? tradesQuery.error.message : 'Unable to load trades'

  return (
    <Card className="trade-feed" aria-label="Trades feed">
      <header className="trade-feed__top">
        <h2>Trades</h2>
        <span>{market.repoId}</span>
      </header>
      <div className="trade-feed__columns" role="row">
        <span role="columnheader">Price</span>
        <span role="columnheader">Size({market.baseTokenSymbol})</span>
        <span role="columnheader">Time</span>
      </div>

      {tradesQuery.status === 'pending' && <Notice className="trade-feed__state">Loading trades...</Notice>}
      {tradesQuery.status === 'error' && !hasRows && <Notice className="trade-feed__state" tone="danger" role="alert">{errorMessage}</Notice>}
      {tradesQuery.status === 'success' && !hasRows && <Notice className="trade-feed__state">No trades available.</Notice>}

      {hasRows && (
        <List
          className="trade-feed__list"
          rowComponent={TradeFeedRow}
          rowCount={trades.length}
          rowHeight={TRADE_ROW_HEIGHT}
          rowProps={{ trades, chainId: market.chainId, baseTokenDecimals }}
          overscanCount={8}
          style={{ height }}
        />
      )}
    </Card>
  )
}
