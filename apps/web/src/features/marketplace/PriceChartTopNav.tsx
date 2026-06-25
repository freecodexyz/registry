import type { Address } from 'viem'
import { chainLabel, explorerAddressUrl } from '../../shared/explorers'
import type { EthUsdPriceState } from './marketPrice'
import {
  MARKET_DAY_LOOKBACK_SECONDS,
  stateFromUsdConversion,
  useMarketCandles,
  type MarketCandleState,
} from './marketCandles'
import {
  candleVolumeUsd,
  formatCompactUsd,
  formatSignedPercent,
  formatSignedUsdChange,
  formatUsdPrice,
  marketCapUsd,
  movementFromChange,
  priceMovementFromCandles,
  type MarketMove,
} from './marketNumbers'
import { useMarketToken } from './marketToken'

type MetricValueState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; message: string }
  | { status: 'ready'; value: string; ariaLabel?: string; tone?: MarketMove }

type PriceChartTopNavState = {
  price: MetricValueState;
  change: MetricValueState;
  volume: MetricValueState;
  marketCap: MetricValueState;
  contract: {
    address: Address;
    chainId: number;
  };
}

export type PriceChartTopNavMarket = {
  repoId: string;
  baseTokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
}

type PriceChartTopNavProps = {
  market: PriceChartTopNavMarket;
  ethUsdPriceState: EthUsdPriceState;
}

function loadingMetric(): MetricValueState {
  return { status: 'loading' }
}

function errorMetric(message: string): MetricValueState {
  return { status: 'error', message }
}

function emptyMetric(message: string): MetricValueState {
  return { status: 'empty', message }
}

function readyMetric(value: string, options?: { tone?: MarketMove; ariaLabel?: string }): MetricValueState {
  return {
    status: 'ready',
    value,
    ...(options?.tone ? { tone: options.tone } : {}),
    ...(options?.ariaLabel ? { ariaLabel: options.ariaLabel } : {}),
  }
}

function unavailableMarketMetric(candleState: MarketCandleState, ethUsdPriceState: EthUsdPriceState, displayState: MarketCandleState): MetricValueState | null {
  switch (candleState.status) {
    case 'loading':
      return loadingMetric()
    case 'error':
      return errorMetric(candleState.message)
    case 'empty':
      return emptyMetric('No candles available')
    case 'ready':
      break
  }

  switch (ethUsdPriceState.status) {
    case 'loading':
      return loadingMetric()
    case 'error':
      return errorMetric(ethUsdPriceState.message)
    case 'empty':
      return emptyMetric('No ETH-USD spot price available')
    case 'ready':
      break
  }

  switch (displayState.status) {
    case 'loading':
      return loadingMetric()
    case 'error':
      return errorMetric(displayState.message)
    case 'empty':
      return emptyMetric('No USD price history available')
    case 'ready':
      return null
  }
}

function truncateAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function metricText(state: MetricValueState) {
  switch (state.status) {
    case 'loading':
      return 'Loading'
    case 'error':
      return 'Unavailable'
    case 'empty':
      return '-'
    case 'ready':
      return state.value
  }
}

function metricTitle(state: MetricValueState) {
  switch (state.status) {
    case 'loading':
      return 'Loading'
    case 'error':
      return state.message
    case 'empty':
      return state.message
    case 'ready':
      return state.ariaLabel ?? state.value
  }
}

function metricClassName(state: MetricValueState) {
  const classNames = ['price-chart-nav__value']

  if (state.status === 'ready' && state.tone) classNames.push(`price-chart-nav__value--${state.tone}`)
  if (state.status !== 'ready') classNames.push(`price-chart-nav__value--${state.status}`)

  return classNames.join(' ')
}

function metricAriaLabel(label: string, state: MetricValueState) {
  switch (state.status) {
    case 'loading':
      return `${label} loading`
    case 'error':
      return `${label} unavailable: ${state.message}`
    case 'empty':
      return `${label} unavailable: ${state.message}`
    case 'ready':
      return state.ariaLabel ?? `${label} ${state.value}`
  }
}

function PriceChartTopNavMetric({ label, state }: { label: string; state: MetricValueState }) {
  return (
    <div className="price-chart-nav__item">
      <span className="price-chart-nav__label">{label}</span>
      <span className={metricClassName(state)} title={metricTitle(state)} aria-label={metricAriaLabel(label, state)}>
        {metricText(state)}
      </span>
    </div>
  )
}

function PriceChartTopNavContract({ address, chainId }: { address: Address; chainId: number }) {
  const explorerLabel = chainLabel(chainId)

  return (
    <div className="price-chart-nav__item price-chart-nav__item--contract">
      <span className="price-chart-nav__label">Contract</span>
      <span className="price-chart-nav__contract-value">
        <span className="price-chart-nav__contract-address" title={address}>{truncateAddress(address)}</span>
        <a className="price-chart-nav__external" href={explorerAddressUrl(chainId, address)} target="_blank" rel="noreferrer" aria-label={`Open token contract on ${explorerLabel} explorer`}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M6 4v1.5h6.44L4.97 12.97l1.06 1.06 7.47-7.47V13H15V4H6Z" />
            <path d="M4.5 5.5H8V7H6v7h7v-2h1.5v3.5h-10v-10Z" />
          </svg>
        </a>
      </span>
    </div>
  )
}

function PriceChartTopNavView({ state, baseTokenSymbol }: { state: PriceChartTopNavState; baseTokenSymbol: string }) {
  return (
    <section className="price-chart-nav" aria-label={`${baseTokenSymbol} market summary`} aria-live="polite">
      <PriceChartTopNavMetric label="Price" state={state.price} />
      <PriceChartTopNavMetric label="24h Change" state={state.change} />
      <PriceChartTopNavMetric label="24h Volume" state={state.volume} />
      <PriceChartTopNavMetric label="Market Cap" state={state.marketCap} />
      <PriceChartTopNavContract address={state.contract.address} chainId={state.contract.chainId} />
    </section>
  )
}

function usePriceChartTopNavState({ market, ethUsdPriceState }: PriceChartTopNavProps): PriceChartTopNavState {
  const { state: candleState } = useMarketCandles({
    repoId: market.repoId,
    interval: '1m',
    lookbackSeconds: MARKET_DAY_LOOKBACK_SECONDS,
  })
  const displayState = stateFromUsdConversion(candleState, ethUsdPriceState)
  const tokenState = useMarketToken({ tokenAddress: market.tokenAddress, chainId: market.chainId })
  const unavailableMetric = unavailableMarketMetric(candleState, ethUsdPriceState, displayState)
  const movement = unavailableMetric == null && displayState.status === 'ready' ? priceMovementFromCandles(displayState.candles) : null

  if (unavailableMetric != null || movement == null) {
    const metric = unavailableMetric ?? emptyMetric('No 24h price data available')

    return {
      price: metric,
      change: metric,
      volume: metric,
      marketCap: metric,
      contract: { address: market.tokenAddress, chainId: market.chainId },
    }
  }

  const formattedPrice = formatUsdPrice(movement.latestPrice)
  const price = readyMetric(formattedPrice, { ariaLabel: `Price ${formattedPrice}` })
  const changeValue = `${formatSignedUsdChange(movement.rawChange)} / ${formatSignedPercent(movement.percentChange)}`
  const change = readyMetric(changeValue, { tone: movementFromChange(movement.rawChange), ariaLabel: `24 hour change ${changeValue}` })
  let volume: MetricValueState = loadingMetric()
  let marketCap: MetricValueState = loadingMetric()

  if (tokenState.decimals.status === 'error') {
    volume = errorMetric(tokenState.decimals.message)
    marketCap = volume
  } else if (tokenState.decimals.status === 'ready') {
    const decimals = tokenState.decimals.decimals
    const volumeUsd = displayState.status === 'ready' ? candleVolumeUsd(displayState.candles, decimals) : null
    const formattedVolume = volumeUsd == null ? null : formatCompactUsd(volumeUsd)
    volume = formattedVolume == null ? emptyMetric('No 24h volume available') : readyMetric(formattedVolume, { ariaLabel: `24 hour volume ${formattedVolume}` })

    if (tokenState.supply.status === 'error') {
      marketCap = errorMetric(tokenState.supply.message)
    } else if (tokenState.supply.status === 'ready') {
      const marketCapValue = marketCapUsd(tokenState.supply.totalSupply, decimals, movement.latestPrice)
      const formattedMarketCap = marketCapValue == null ? null : formatCompactUsd(marketCapValue)
      marketCap = formattedMarketCap == null ? emptyMetric('Market cap unavailable') : readyMetric(formattedMarketCap, { ariaLabel: `Market cap ${formattedMarketCap}` })
    }
  }

  return {
    price,
    change,
    volume,
    marketCap,
    contract: { address: market.tokenAddress, chainId: market.chainId },
  }
}

export function PriceChartTopNav({ market, ethUsdPriceState }: PriceChartTopNavProps) {
  const state = usePriceChartTopNavState({ market, ethUsdPriceState })

  return <PriceChartTopNavView state={state} baseTokenSymbol={market.baseTokenSymbol} />
}
