import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Notice } from '@freecodexyz/ui'
import { formatUnits } from 'viem'
import { tokensPerWethToUsdPrice, type EthUsdPriceState } from './marketPrice'
import { MARKET_LIVE_REFETCH_INTERVAL_MS, useSubscription } from './ws'

const DEFAULT_TOKEN_DECIMALS = 18
const USD_PRICE_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 8 })
const ETH_SPOT_FORMAT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const TOKEN_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const PERCENT_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

type DepthSide = 'ask' | 'bid'

type DepthLevel = {
  price: number;
  size: string;
  cumulative: string;
}

type DepthBook = {
  tick: number;
  sqrtPriceX96: string;
  bids: DepthLevel[];
  asks: DepthLevel[];
  repoId?: string;
  blockNumber?: number;
}

export type OrderBookMarket = {
  repoId: string;
  baseTokenSymbol: string;
  baseTokenDecimals?: number;
}

type OrderBookProps = {
  market: OrderBookMarket;
  ethUsdPriceState: EthUsdPriceState;
}

type OrderBookState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; book: DepthBook }

type OrderBookRowProps = {
  side: DepthSide;
  level: DepthLevel;
  tokenDecimals: number;
  maxCumulative: bigint;
  ethUsdPriceState: EthUsdPriceState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBigIntString(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    BigInt(value)
    return true
  } catch {
    return false
  }
}

function isDepthLevel(value: unknown): value is DepthLevel {
  return isRecord(value) &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    isBigIntString(value.size) &&
    isBigIntString(value.cumulative)
}

function isDepthBook(value: unknown): value is DepthBook {
  return isRecord(value) &&
    typeof value.tick === 'number' &&
    Number.isFinite(value.tick) &&
    typeof value.sqrtPriceX96 === 'string' &&
    Array.isArray(value.bids) &&
    value.bids.every(isDepthLevel) &&
    Array.isArray(value.asks) &&
    value.asks.every(isDepthLevel) &&
    (value.repoId === undefined || typeof value.repoId === 'string') &&
    (value.blockNumber === undefined || (typeof value.blockNumber === 'number' && Number.isFinite(value.blockNumber)))
}

function parseDepthBook(value: unknown): DepthBook {
  if (!isDepthBook(value)) throw new Error('invalid depth response')

  return {
    tick: value.tick,
    sqrtPriceX96: value.sqrtPriceX96,
    bids: value.bids,
    asks: value.asks,
    ...(value.repoId ? { repoId: value.repoId } : {}),
    ...(value.blockNumber != null ? { blockNumber: value.blockNumber } : {}),
  }
}

function parseLiveDepthBook(value: unknown): DepthBook | null {
  try {
    return parseDepthBook(value)
  } catch {
    return null
  }
}

async function loadDepthBook(repoId: string, signal: AbortSignal): Promise<DepthBook> {
  const response = await fetch(`/api/market/${encodeURIComponent(repoId)}/depth`, { signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseDepthBook(await response.json() as unknown)
}

function absoluteBigInt(value: string): bigint {
  try {
    const amount = BigInt(value)
    return amount < 0n ? -amount : amount
  } catch {
    return 0n
  }
}

function maxCumulative(...levelGroups: readonly DepthLevel[][]): bigint {
  return levelGroups.flat().reduce((max, level) => {
    const amount = absoluteBigInt(level.cumulative)
    return amount > max ? amount : max
  }, 0n)
}

function depthPercent(level: DepthLevel, max: bigint): number {
  if (max <= 0n) return 0

  const amount = absoluteBigInt(level.cumulative)
  return Number((amount * 10_000n) / max) / 100
}

function formatPrice(value: number, ethUsdPriceState: EthUsdPriceState) {
  if (ethUsdPriceState.status !== 'ready') return '-'

  const usdPrice = tokensPerWethToUsdPrice(value, ethUsdPriceState.usdPrice)
  return usdPrice == null ? '-' : USD_PRICE_FORMAT.format(usdPrice)
}

function formatTokenAmount(value: string, decimals: number) {
  try {
    const amount = Number(formatUnits(BigInt(value), decimals))
    return Number.isFinite(amount) ? TOKEN_FORMAT.format(amount) : '-'
  } catch {
    return '-'
  }
}

function formatSpreadPercent(bestBid: DepthLevel | undefined, bestAsk: DepthLevel | undefined) {
  if (!bestBid || !bestAsk) return '-'

  const mid = (bestBid.price + bestAsk.price) / 2
  if (!Number.isFinite(mid) || mid <= 0) return '-'

  return `${PERCENT_FORMAT.format((Math.max(0, bestAsk.price - bestBid.price) / mid) * 100)}%`
}

function formatSpread(bestBid: DepthLevel | undefined, bestAsk: DepthLevel | undefined, ethUsdPriceState: EthUsdPriceState) {
  if (!bestBid || !bestAsk) return '-'

  return formatPrice(Math.max(0, bestAsk.price - bestBid.price), ethUsdPriceState)
}

function priceConversionStatus(ethUsdPriceState: EthUsdPriceState) {
  if (ethUsdPriceState.status === 'ready') return `ETH/USD ${ETH_SPOT_FORMAT.format(ethUsdPriceState.usdPrice)}`
  if (ethUsdPriceState.status === 'loading') return 'Loading USD price'
  if (ethUsdPriceState.status === 'error') return 'USD price unavailable'

  return 'No USD price'
}

function stateFromQuery(book: DepthBook | undefined, status: 'error' | 'pending' | 'success', error: Error | null): OrderBookState {
  if (book) {
    if (book.bids.length === 0 && book.asks.length === 0) return { status: 'empty' }
    return { status: 'ready', book }
  }

  if (status === 'pending') return { status: 'loading' }
  if (status === 'error') return { status: 'error', message: error?.message ?? 'Unable to load order book' }

  return { status: 'empty' }
}

function OrderBookColumns({ baseTokenSymbol }: { baseTokenSymbol: string }) {
  return (
    <div className="order-book__columns" role="row">
      <span role="columnheader">Price (USD)</span>
      <span role="columnheader">Size ({baseTokenSymbol})</span>
      <span role="columnheader">Total ({baseTokenSymbol})</span>
    </div>
  )
}

function OrderBookRow({ side, level, tokenDecimals, maxCumulative, ethUsdPriceState }: OrderBookRowProps) {
  const price = formatPrice(level.price, ethUsdPriceState)
  const size = formatTokenAmount(level.size, tokenDecimals)
  const total = formatTokenAmount(level.cumulative, tokenDecimals)
  const sideLabel = side === 'ask' ? 'Ask' : 'Bid'

  return (
    <div className={`order-book__row order-book__row--${side}`} role="row" aria-label={`${sideLabel} price ${price}, size ${size}, total ${total}`}>
      <span className="order-book__depth-fill" style={{ width: `${depthPercent(level, maxCumulative)}%` }} aria-hidden="true" />
      <span className={`order-book__cell order-book__number order-book__price order-book__price--${side}`} role="cell">{price}</span>
      <span className="order-book__cell order-book__cell--right order-book__number" role="cell">{size}</span>
      <span className="order-book__cell order-book__cell--right order-book__number" role="cell">{total}</span>
    </div>
  )
}

function OrderBookSpread({ bestBid, bestAsk, ethUsdPriceState }: { bestBid: DepthLevel | undefined; bestAsk: DepthLevel | undefined; ethUsdPriceState: EthUsdPriceState }) {
  return (
    <div className="order-book__spread" role="row" aria-label="Order book spread">
      <span role="cell">Spread</span>
      <span className="order-book__number" role="cell">{formatSpread(bestBid, bestAsk, ethUsdPriceState)}</span>
      <span className="order-book__number" role="cell">{formatSpreadPercent(bestBid, bestAsk)}</span>
    </div>
  )
}

function OrderBookLadder({ book, market, ethUsdPriceState }: { book: DepthBook; market: OrderBookMarket; ethUsdPriceState: EthUsdPriceState }) {
  const tokenDecimals = market.baseTokenDecimals ?? DEFAULT_TOKEN_DECIMALS
  const asks = book.asks.toReversed()
  const bestAsk = book.asks[0]
  const bestBid = book.bids[0]
  const cumulativeMax = maxCumulative(book.asks, book.bids)

  return (
    <div className="order-book__ladder" role="rowgroup">
      <div className="order-book__levels order-book__levels--asks">
        {asks.map((level) => <OrderBookRow key={`ask:${level.price}`} side="ask" level={level} tokenDecimals={tokenDecimals} maxCumulative={cumulativeMax} ethUsdPriceState={ethUsdPriceState} />)}
      </div>
      <OrderBookSpread bestBid={bestBid} bestAsk={bestAsk} ethUsdPriceState={ethUsdPriceState} />
      <div className="order-book__levels order-book__levels--bids">
        {book.bids.map((level) => <OrderBookRow key={`bid:${level.price}`} side="bid" level={level} tokenDecimals={tokenDecimals} maxCumulative={cumulativeMax} ethUsdPriceState={ethUsdPriceState} />)}
      </div>
    </div>
  )
}

function OrderBookBody({ state, market, ethUsdPriceState }: { state: OrderBookState; market: OrderBookMarket; ethUsdPriceState: EthUsdPriceState }) {
  if (state.status === 'loading') return <Notice className="order-book__state">Loading order book...</Notice>
  if (state.status === 'error') return <Notice className="order-book__state" tone="danger" role="alert">{state.message}</Notice>
  if (state.status === 'empty') return <Notice className="order-book__state">No depth available.</Notice>

  return <OrderBookLadder book={state.book} market={market} ethUsdPriceState={ethUsdPriceState} />
}

export function OrderBook({ market, ethUsdPriceState }: OrderBookProps) {
  const queryClient = useQueryClient()
  const depthQueryKey = ['depth', market.repoId] as const
  const depthQuery = useQuery({
    queryKey: depthQueryKey,
    queryFn: ({ signal }) => loadDepthBook(market.repoId, signal),
    refetchInterval: MARKET_LIVE_REFETCH_INTERVAL_MS,
  })

  useSubscription<unknown>('depth', market.repoId, (payload) => {
    const book = parseLiveDepthBook(payload)
    if (!book) return

    queryClient.setQueryData<DepthBook>(depthQueryKey, book)
  })

  const state = stateFromQuery(depthQuery.data, depthQuery.status, depthQuery.error)

  return (
    <Card className="order-book" aria-label="Order book">
      <header className="order-book__top">
        <h2>Order Book</h2>
        <span aria-live="polite">{priceConversionStatus(ethUsdPriceState)}</span>
      </header>
      <div className="order-book__table" role="table" aria-label={`${market.baseTokenSymbol} order book`}>
        <OrderBookColumns baseTokenSymbol={market.baseTokenSymbol} />
        <OrderBookBody state={state} market={market} ethUsdPriceState={ethUsdPriceState} />
      </div>
    </Card>
  )
}
