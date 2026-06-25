import { useQuery } from '@tanstack/react-query'
import { Notice } from '@freecodexyz/ui'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { baseSepolia } from 'wagmi/chains'
import { OrderEntry } from './OrderEntry'
import { OrderBook } from './OrderBook'
import { TradeFeed } from './TradeFeed'
import { PriceChart } from './PriceChart'
import { useEthUsdPrice } from './marketPrice'

type MarketSummary = {
  repoId: string;
  symbol: string;
}

type MarketSelectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; market: MarketSummary }

const MARKET_PANEL_SIZES = [75, 12.5, 12.5]
const MARKET_STACK_SIZES = [50, 50]

const demoMarket = {
  baseTokenSymbol: 'TOKEN1',
  quoteTokenSymbol: 'TOKEN2',
  quotePerBase: 1,
}

const demoBalances = {
  baseAvailable: 0,
  quoteAvailable: 0,
}

const demoCosts = {
  slippageBps: 50,
  feeBps: 30,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMarketSummary(value: unknown): value is MarketSummary {
  return isRecord(value) && typeof value.repoId === 'string' && typeof value.symbol === 'string'
}

function parseMarketsResponse(value: unknown): MarketSummary[] {
  if (isRecord(value) && Array.isArray(value.markets) && value.markets.every(isMarketSummary)) return value.markets

  throw new Error('invalid markets response')
}

async function loadMarkets(signal: AbortSignal): Promise<MarketSummary[]> {
  const response = await fetch('/api/markets', { signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseMarketsResponse(await response.json() as unknown)
}

function stateFromMarkets(markets: MarketSummary[] | undefined, status: 'error' | 'pending' | 'success', error: Error | null): MarketSelectionState {
  const activeMarket = markets?.[0]
  if (activeMarket) return { status: 'ready', market: activeMarket }
  if (status === 'pending') return { status: 'loading' }
  if (status === 'error') return { status: 'error', message: error?.message ?? 'Unable to load markets' }

  return { status: 'empty' }
}

function MarketPaneNotice({ state }: { state: MarketSelectionState }) {
  if (state.status === 'ready') return null
  if (state.status === 'loading') return <Notice className="marketplace__notice">Loading markets...</Notice>
  if (state.status === 'error') return <Notice className="marketplace__notice" tone="danger" role="alert">{state.message}</Notice>

  return <Notice className="marketplace__notice">No launched markets available.</Notice>
}

export function Marketplace() {
  const marketsQuery = useQuery({
    queryKey: ['markets'],
    queryFn: ({ signal }) => loadMarkets(signal),
  })
  const marketState = stateFromMarkets(marketsQuery.data, marketsQuery.status, marketsQuery.error)
  const activeMarket = marketState.status === 'ready' ? marketState.market : null
  const ethUsdPriceState = useEthUsdPrice(activeMarket != null)
  const orderMarket = {
    ...demoMarket,
    baseTokenSymbol: activeMarket?.symbol ?? demoMarket.baseTokenSymbol,
  }

  return (
    <main className="marketplace" data-accent="emerald">
      <Allotment className="marketplace__layout" defaultSizes={MARKET_PANEL_SIZES} proportionalLayout>
        <Allotment.Pane minSize={420}>
          <section className="marketplace__pane marketplace__chart" aria-label="Market price chart">
            {activeMarket ? (
              <PriceChart
                market={{
                  repoId: activeMarket.repoId,
                  baseTokenSymbol: activeMarket.symbol,
                  quoteTokenSymbol: demoMarket.quoteTokenSymbol,
                }}
                ethUsdPriceState={ethUsdPriceState}
              />
            ) : (
              <MarketPaneNotice state={marketState} />
            )}
          </section>
        </Allotment.Pane>

        <Allotment.Pane minSize={280}>
          <Allotment className="marketplace__flow" defaultSizes={MARKET_STACK_SIZES} proportionalLayout vertical>
            <Allotment.Pane minSize={170}>
              <section className="marketplace__pane marketplace__book" aria-label="Market order book">
                {activeMarket ? (
                  <OrderBook
                    market={{
                      repoId: activeMarket.repoId,
                      baseTokenSymbol: activeMarket.symbol,
                    }}
                    ethUsdPriceState={ethUsdPriceState}
                  />
                ) : (
                  <MarketPaneNotice state={marketState} />
                )}
              </section>
            </Allotment.Pane>

            <Allotment.Pane minSize={150}>
              <section className="marketplace__pane marketplace__feed" aria-label="Market trades">
                {activeMarket ? (
                  <TradeFeed
                    market={{
                      repoId: activeMarket.repoId,
                      baseTokenSymbol: activeMarket.symbol,
                      chainId: baseSepolia.id,
                    }}
                    ethUsdPriceState={ethUsdPriceState}
                  />
                ) : (
                  <MarketPaneNotice state={marketState} />
                )}
              </section>
            </Allotment.Pane>
          </Allotment>
        </Allotment.Pane>

        <Allotment.Pane minSize={300}>
          <section className="marketplace__pane marketplace__entry" aria-label="Order entry">
            <OrderEntry market={orderMarket} balances={demoBalances} costs={demoCosts} />
          </section>
        </Allotment.Pane>
      </Allotment>
    </main>
  )
}
