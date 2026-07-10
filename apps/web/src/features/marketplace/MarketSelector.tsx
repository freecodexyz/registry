import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import type { Address } from 'viem'
import type { EthUsdPriceState } from './marketPrice'
import { MARKET_DAY_LOOKBACK_SECONDS, stateFromUsdConversion, useMarketCandles, type MarketCandleState } from './marketCandles'
import {
  candleVolumeUsd,
  formatCompactUsd,
  formatSignedPercent,
  formatSignedUsdChange,
  formatUsdPrice,
  movementFromChange,
  priceMovementFromCandles,
  type MarketMove,
} from './marketNumbers'
import { useMarketTokenDecimals } from './marketToken'

export type MarketSelectorMarket = {
  repoId: string;
  baseTokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
}

type MarketSelectorMetricState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; message: string }
  | { status: 'ready'; value: string; ariaLabel?: string; tone?: MarketMove }

type MarketSelectorRowState = {
  price: MarketSelectorMetricState;
  change: MarketSelectorMetricState;
  volume: MarketSelectorMetricState;
}

type MarketSelectorProps = {
  market: MarketSelectorMarket;
  markets: readonly MarketSelectorMarket[];
  quoteTokenSymbol: string;
  ethUsdPriceState: EthUsdPriceState;
  onMarketSelect: (repoId: string) => void;
}

type MarketSelectorListProps = {
  markets: readonly MarketSelectorMarket[];
  selectedRepoId: string;
  quoteTokenSymbol: string;
  ethUsdPriceState: EthUsdPriceState;
  onMarketSelect: (repoId: string) => void;
  onRequestClose: () => void;
}

type MarketSelectorRowProps = {
  market: MarketSelectorMarket;
  selectedRepoId: string;
  quoteTokenSymbol: string;
  ethUsdPriceState: EthUsdPriceState;
  style: CSSProperties;
  rowIndex: number;
  onMarketSelect: (repoId: string) => void;
  onRequestClose: () => void;
}

type VirtualViewportState = {
  height: number;
  scrollTop: number;
}

const MARKET_SELECTOR_ROW_HEIGHT = 38
const MARKET_SELECTOR_LIST_MAX_HEIGHT = 304
const MARKET_SELECTOR_OVERSCAN_ROWS = 6

function loadingMetric(): MarketSelectorMetricState {
  return { status: 'loading' }
}

function errorMetric(message: string): MarketSelectorMetricState {
  return { status: 'error', message }
}

function emptyMetric(message: string): MarketSelectorMetricState {
  return { status: 'empty', message }
}

function readyMetric(value: string, options?: { tone?: MarketMove; ariaLabel?: string }): MarketSelectorMetricState {
  return {
    status: 'ready',
    value,
    ...(options?.tone ? { tone: options.tone } : {}),
    ...(options?.ariaLabel ? { ariaLabel: options.ariaLabel } : {}),
  }
}

function marketPairLabel(baseTokenSymbol: string, quoteTokenSymbol: string) {
  return `${baseTokenSymbol}/${quoteTokenSymbol}`
}

function metricText(state: MarketSelectorMetricState) {
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

function metricTitle(state: MarketSelectorMetricState) {
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

function metricClassName(state: MarketSelectorMetricState) {
  const classNames = ['market-selector__metric']

  if (state.status === 'ready' && state.tone) classNames.push(`market-selector__metric--${state.tone}`)
  if (state.status !== 'ready') classNames.push(`market-selector__metric--${state.status}`)

  return classNames.join(' ')
}

function unavailableMarketMetric(candleState: MarketCandleState, ethUsdPriceState: EthUsdPriceState, displayState: MarketCandleState): MarketSelectorMetricState | null {
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

function useMarketSelectorRowState({ market, ethUsdPriceState }: { market: MarketSelectorMarket; ethUsdPriceState: EthUsdPriceState }): MarketSelectorRowState {
  const { state: candleState } = useMarketCandles({
    repoId: market.repoId,
    interval: '1m',
    lookbackSeconds: MARKET_DAY_LOOKBACK_SECONDS,
  })
  const displayState = stateFromUsdConversion(candleState, ethUsdPriceState)
  const decimalsState = useMarketTokenDecimals({ tokenAddress: market.tokenAddress, chainId: market.chainId })
  const unavailableMetric = unavailableMarketMetric(candleState, ethUsdPriceState, displayState)
  const movement = unavailableMetric == null && displayState.status === 'ready' ? priceMovementFromCandles(displayState.candles) : null

  if (unavailableMetric != null || movement == null || displayState.status !== 'ready') {
    const metric = unavailableMetric ?? emptyMetric('No 24h price data available')

    return { price: metric, change: metric, volume: metric }
  }

  const formattedPrice = formatUsdPrice(movement.latestPrice)
  const formattedUsdChange = formatSignedUsdChange(movement.rawChange)
  const formattedPercentChange = formatSignedPercent(movement.percentChange)
  const price = readyMetric(formattedPrice, { ariaLabel: `Last price ${formattedPrice}` })
  const change = readyMetric(formattedPercentChange, {
    tone: movementFromChange(movement.rawChange),
    ariaLabel: `24 hour change ${formattedUsdChange} / ${formattedPercentChange}`,
  })
  let volume: MarketSelectorMetricState = loadingMetric()

  switch (decimalsState.status) {
    case 'loading':
      volume = loadingMetric()
      break
    case 'error':
      volume = errorMetric(decimalsState.message)
      break
    case 'ready': {
      const volumeUsd = candleVolumeUsd(displayState.candles, decimalsState.decimals)
      const formattedVolume = volumeUsd == null ? null : formatCompactUsd(volumeUsd)
      volume = formattedVolume == null ? emptyMetric('No 24h volume available') : readyMetric(formattedVolume, { ariaLabel: `24 hour volume ${formattedVolume}` })
      break
    }
  }

  return { price, change, volume }
}

function virtualRange(viewport: VirtualViewportState, rowCount: number, fallbackHeight: number) {
  if (rowCount === 0) return { startIndex: 0, endIndex: 0 }

  const height = viewport.height > 0 ? viewport.height : fallbackHeight
  const startIndex = Math.max(0, Math.floor(viewport.scrollTop / MARKET_SELECTOR_ROW_HEIGHT) - MARKET_SELECTOR_OVERSCAN_ROWS)
  const visibleRows = Math.ceil(height / MARKET_SELECTOR_ROW_HEIGHT) + MARKET_SELECTOR_OVERSCAN_ROWS * 2
  const endIndex = Math.min(rowCount, startIndex + visibleRows)

  return { startIndex, endIndex }
}

function MarketSelectorMetric({ state }: { state: MarketSelectorMetricState }) {
  return <span className={metricClassName(state)} title={metricTitle(state)}>{metricText(state)}</span>
}

function MarketSelectorRow({ market, selectedRepoId, quoteTokenSymbol, ethUsdPriceState, style, rowIndex, onMarketSelect, onRequestClose }: MarketSelectorRowProps) {
  const state = useMarketSelectorRowState({ market, ethUsdPriceState })
  const pairLabel = marketPairLabel(market.baseTokenSymbol, quoteTokenSymbol)
  const isSelected = market.repoId === selectedRepoId

  function selectMarket() {
    onMarketSelect(market.repoId)
    onRequestClose()
  }

  function selectMarketWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    selectMarket()
  }

  return (
    <div
      className="market-selector__row"
      style={style}
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-label={`Switch to ${pairLabel} market`}
      aria-current={isSelected ? 'true' : undefined}
      tabIndex={0}
      onClick={selectMarket}
      onKeyDown={selectMarketWithKeyboard}
    >
      <span className="market-selector__cell market-selector__cell--market" role="cell">
        <span className="market-selector__market-pair">{pairLabel}</span>
        <span className="market-selector__market-id">RIK {market.repoId}</span>
      </span>
      <span className="market-selector__cell market-selector__cell--numeric" role="cell"><MarketSelectorMetric state={state.price} /></span>
      <span className="market-selector__cell market-selector__cell--numeric" role="cell"><MarketSelectorMetric state={state.change} /></span>
      <span className="market-selector__cell market-selector__cell--numeric" role="cell"><MarketSelectorMetric state={state.volume} /></span>
    </div>
  )
}

function MarketSelectorVirtualList({ markets, selectedRepoId, quoteTokenSymbol, ethUsdPriceState, onMarketSelect, onRequestClose }: MarketSelectorListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<VirtualViewportState>({ height: 0, scrollTop: 0 })
  const viewportHeight = Math.min(markets.length * MARKET_SELECTOR_ROW_HEIGHT, MARKET_SELECTOR_LIST_MAX_HEIGHT)
  const range = virtualRange(viewport, markets.length, viewportHeight)
  const visibleMarkets = markets.slice(range.startIndex, range.endIndex)

  useEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const viewportNode = node

    function updateViewport() {
      setViewport((current) => {
        const next = { height: viewportNode.clientHeight, scrollTop: viewportNode.scrollTop }
        return current.height === next.height && current.scrollTop === next.scrollTop ? current : next
      })
    }

    updateViewport()
    viewportNode.addEventListener('scroll', updateViewport, { passive: true })

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateViewport)
    resizeObserver?.observe(viewportNode)

    return () => {
      viewportNode.removeEventListener('scroll', updateViewport)
      resizeObserver?.disconnect()
    }
  }, [])

  return (
    <div className="market-selector__viewport" ref={viewportRef} style={{ height: viewportHeight }} role="rowgroup">
      <div className="market-selector__spacer" style={{ height: markets.length * MARKET_SELECTOR_ROW_HEIGHT }}>
        {visibleMarkets.map((visibleMarket, visibleIndex) => {
          const rowIndex = range.startIndex + visibleIndex
          const rowStyle: CSSProperties = {
            height: MARKET_SELECTOR_ROW_HEIGHT,
            transform: `translateY(${rowIndex * MARKET_SELECTOR_ROW_HEIGHT}px)`,
          }

          return (
            <MarketSelectorRow
              key={visibleMarket.repoId}
              market={visibleMarket}
              selectedRepoId={selectedRepoId}
              quoteTokenSymbol={quoteTokenSymbol}
              ethUsdPriceState={ethUsdPriceState}
              style={rowStyle}
              rowIndex={rowIndex}
              onMarketSelect={onMarketSelect}
              onRequestClose={onRequestClose}
            />
          )
        })}
      </div>
    </div>
  )
}

export function MarketSelector({ market, markets, quoteTokenSymbol, ethUsdPriceState, onMarketSelect }: MarketSelectorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const pairLabel = marketPairLabel(market.baseTokenSymbol, quoteTokenSymbol)

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && !rootRef.current?.contains(target)) setIsOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return


      setIsOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  function toggleMenu() {
    setIsOpen((current) => !current)
  }

  function closeMenu() {
    setIsOpen(false)
  }

  return (
    <div className="market-selector" ref={rootRef}>
      <button
        className="market-selector__trigger"
        type="button"
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={toggleMenu}
      >
        <span className="market-selector__pair">{pairLabel}</span>
        <span className="market-selector__arrow" aria-hidden="true">
          {isOpen ? <FiChevronUp focusable="false" /> : <FiChevronDown focusable="false" />}
        </span>
      </button>

      {isOpen && (
        <div className="market-selector__menu" id={menuId} role="dialog" aria-label="Indexed markets" aria-live="off">
          <div className="market-selector__table" role="table" aria-label="Indexed market token pairs" aria-rowcount={markets.length + 1}>
            <div className="market-selector__header" role="rowgroup">
              <div className="market-selector__header-row" role="row">
                <span role="columnheader">Market</span>
                <span role="columnheader">Last Price</span>
                <span role="columnheader">24h change</span>
                <span role="columnheader">Volume</span>
              </div>
            </div>
            <MarketSelectorVirtualList
              markets={markets}
              selectedRepoId={market.repoId}
              quoteTokenSymbol={quoteTokenSymbol}
              ethUsdPriceState={ethUsdPriceState}
              onMarketSelect={onMarketSelect}
              onRequestClose={closeMenu}
            />
          </div>
        </div>
      )}
    </div>
  )
}
