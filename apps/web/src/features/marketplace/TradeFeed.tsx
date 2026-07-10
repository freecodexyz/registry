import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Notice } from '@freecodexyz/ui'
import { AutoSizer } from 'react-virtualized-auto-sizer'
import { FiExternalLink } from 'react-icons/fi'
import { List } from 'react-window'
import type { RowComponentProps } from 'react-window'
import { explorerTxUrl } from '../../shared/explorers'
import type { EthUsdPriceState } from './marketPrice'
import { DEFAULT_TOKEN_DECIMALS, formatTokensPerWethUsdPrice, formatTradeSize, sqrtPriceX96ToTokenPrice } from './marketNumbers'
import { MARKET_LIVE_REFETCH_INTERVAL_MS, useSubscription } from './ws'

const DEFAULT_TRADE_LIMIT = 5_000
const TRADE_ROW_HEIGHT = 24

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
  ethUsdPriceState: EthUsdPriceState;
  limit?: number;
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
  ethUsdPriceState: EthUsdPriceState;
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

function parseLiveTrade(value: unknown): Trade | null {
  if (!isLiveTradePayload(value)) return null

  const size = absoluteBigIntString(value.amount1)
  const side = sideFromAmount0(value.amount0)
  const price = sqrtPriceX96ToTokenPrice(value.sqrtPriceX96)
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

function TradeFeedRow({ index, style, ariaAttributes, trades, chainId, baseTokenDecimals, ethUsdPriceState }: RowComponentProps<TradeFeedRowProps>) {
  const trade = trades[index]
  if (!trade) return null

  const price = formatTokensPerWethUsdPrice(trade.price, ethUsdPriceState)
  const sideLabel = trade.side === 'buy' ? 'BUY' : 'SELL'
  const time = formatTradeTime(trade.ts)

  return (
    <div {...ariaAttributes} className="trade-feed__row" style={style}>
      <span className={`trade-feed__cell trade-feed__number trade-feed__price trade-feed__price--${trade.side}`} aria-label={`${sideLabel} price ${price}`}>
        {price}
      </span>
      <span className="trade-feed__cell trade-feed__number">{formatTradeSize(trade.size, baseTokenDecimals)}</span>
      <span className="trade-feed__cell trade-feed__time">
        <time dateTime={time.iso}>
          <span className="trade-feed__number">{time.hours}</span>
          <span>:</span>
          <span className="trade-feed__number">{time.minutes}</span>
          <span>:</span>
          <span className="trade-feed__number">{time.seconds}</span>
        </time>
        <a className="trade-feed__tx-link" href={explorerTxUrl(chainId, trade.txHash)} target="_blank" rel="noreferrer" aria-label={`Open ${sideLabel} transaction on Base Sepolia explorer`}>
          <FiExternalLink aria-hidden="true" focusable="false" />
        </a>
      </span>
    </div>
  )
}

export function TradeFeed({ market, ethUsdPriceState, limit = DEFAULT_TRADE_LIMIT }: TradeFeedProps) {
  const queryClient = useQueryClient()
  const tradeQueryKey = ['trades', market.repoId, limit] as const
  const baseTokenDecimals = market.baseTokenDecimals ?? DEFAULT_TOKEN_DECIMALS
  const tradesQuery = useQuery({
    queryKey: tradeQueryKey,
    queryFn: ({ signal }) => loadTrades(market.repoId, limit, signal),
    refetchInterval: MARKET_LIVE_REFETCH_INTERVAL_MS,
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
      </header>
      <div className="trade-feed__columns" role="row">
        <span role="columnheader">Price (USD)</span>
        <span role="columnheader">Size({market.baseTokenSymbol})</span>
        <span role="columnheader">Time</span>
      </div>

      <div className="trade-feed__body">
        {tradesQuery.status === 'pending' && <Notice className="trade-feed__state">Loading trades...</Notice>}
        {tradesQuery.status === 'error' && !hasRows && <Notice className="trade-feed__state" tone="danger" role="alert">{errorMessage}</Notice>}
        {tradesQuery.status === 'success' && !hasRows && <Notice className="trade-feed__state">No trades available.</Notice>}

        {hasRows && (
          <AutoSizer
            renderProp={({ height, width }) => {
              const listHeight = height ?? 0
              const listWidth = width ?? 0
              if (listHeight <= 0 || listWidth <= 0) return null

              return (
                <List
                  className="trade-feed__list"
                  rowComponent={TradeFeedRow}
                  rowCount={trades.length}
                  rowHeight={TRADE_ROW_HEIGHT}
                  rowProps={{ trades, chainId: market.chainId, baseTokenDecimals, ethUsdPriceState }}
                  overscanCount={8}
                  style={{ height: listHeight, width: listWidth }}
                />
              )
            }}
          />
        )}
      </div>
    </Card>
  )
}
