import { useEffect, useRef } from 'react'
import type { Address } from 'viem'
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
import type { EthUsdPriceState } from './marketPrice'
import {
  DEFAULT_CANDLE_INTERVAL,
  DEFAULT_CHART_LOOKBACK_SECONDS,
  stateFromUsdConversion,
  toUsdCandles,
  useMarketCandles,
  type CandleInterval,
  type MarketCandle,
  type MarketCandleState,
} from './marketCandles'
import {
  formatMarketCapPointerValue,
  formatMarketCapRulerValues,
  formatMarketCapUsd,
  formatSignedPercent,
  formatSignedUsdChange,
  movementFromChange,
  normalizedTokenVolume,
  priceMovement,
  tokenAmountFromBaseUnits,
} from './marketNumbers'
import { useMarketToken, type MarketTokenState } from './marketToken'

const PRICE_SCALE_MIN_WIDTH = 148

type ChartTheme = {
  up: string;
  down: string;
  volumeUp: string;
  volumeDown: string;
  background: string;
  grid: string;
  text: string;
  crosshair: string;
}

const DEFAULT_CHART_THEME: ChartTheme = {
  up: '#00c565',
  down: '#ff4d57',
  volumeUp: 'rgba(0, 197, 101, 0.36)',
  volumeDown: 'rgba(255, 77, 87, 0.36)',
  background: '#071009',
  grid: 'rgba(122, 143, 151, 0.08)',
  text: '#aeb8c2',
  crosshair: 'rgba(204, 216, 224, 0.56)',
}

export type PriceChartMarket = {
  repoId: string;
  baseTokenSymbol: string;
  quoteTokenSymbol: string;
  tokenAddress: Address;
  chainId: number;
  baseTokenDecimals?: number;
}

type PriceChartProps = {
  market: PriceChartMarket;
  ethUsdPriceState: EthUsdPriceState;
  interval?: CandleInterval;
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
    value: normalizedTokenVolume(candle.volume, decimals) ?? 0,
    color: candle.close >= candle.open ? upColor : downColor,
  }
}

function scaleMarketCapValue(value: number, supply: number): number | null {
  const marketCap = value * supply

  return Number.isFinite(marketCap) && marketCap >= 0 ? marketCap : null
}

function toMarketCapCandle(candle: MarketCandle, supply: number): MarketCandle | null {
  const open = scaleMarketCapValue(candle.open, supply)
  const high = scaleMarketCapValue(candle.high, supply)
  const low = scaleMarketCapValue(candle.low, supply)
  const close = scaleMarketCapValue(candle.close, supply)

  if (open == null || high == null || low == null || close == null) return null

  return { ...candle, open, high, low, close }
}

function toMarketCapCandles(candles: MarketCandle[], totalSupply: bigint, decimals: number): MarketCandle[] | null {
  const supply = tokenAmountFromBaseUnits(totalSupply, decimals)
  if (supply == null || supply < 0) return null

  const marketCapCandles: MarketCandle[] = []
  for (const candle of candles) {
    const marketCapCandle = toMarketCapCandle(candle, supply)
    if (!marketCapCandle) return null

    marketCapCandles.push(marketCapCandle)
  }

  return marketCapCandles
}

function stateFromMarketCapConversion(displayState: MarketCandleState, tokenState: MarketTokenState): MarketCandleState {
  if (displayState.status !== 'ready') return displayState
  if (tokenState.decimals.status === 'loading' || tokenState.supply.status === 'loading') return { status: 'loading' }
  if (tokenState.decimals.status === 'error') return { status: 'error', message: tokenState.decimals.message }
  if (tokenState.supply.status === 'error') return { status: 'error', message: tokenState.supply.message }

  const candles = toMarketCapCandles(displayState.candles, tokenState.supply.totalSupply, tokenState.decimals.decimals)
  if (!candles) return { status: 'error', message: 'Unable to convert price history to market cap' }
  if (candles.length === 0) return { status: 'empty' }

  return { status: 'ready', candles }
}

function readChartTheme(container: HTMLElement): ChartTheme {
  return {
    up: chartColor(container, '--chart-up', DEFAULT_CHART_THEME.up),
    down: chartColor(container, '--chart-down', DEFAULT_CHART_THEME.down),
    volumeUp: chartColor(container, '--chart-volume-up', DEFAULT_CHART_THEME.volumeUp),
    volumeDown: chartColor(container, '--chart-volume-down', DEFAULT_CHART_THEME.volumeDown),
    background: chartColor(container, '--chart-bg', DEFAULT_CHART_THEME.background),
    grid: chartColor(container, '--chart-grid', DEFAULT_CHART_THEME.grid),
    text: chartColor(container, '--chart-text', DEFAULT_CHART_THEME.text),
    crosshair: chartColor(container, '--chart-crosshair', DEFAULT_CHART_THEME.crosshair),
  }
}

function priceLineColor(candle: MarketCandle | null, theme: ChartTheme) {
  return candle && candle.close >= candle.open ? theme.up : theme.down
}

function formatMarketCapTickmarks(values: number[]) {
  return formatMarketCapRulerValues(values)
}

function PriceChartLegend({ market, interval, state }: { market: PriceChartMarket; interval: CandleInterval; state: MarketCandleState }) {
  const candle = state.status === 'ready' ? state.candles.at(-1) : null
  const previous = state.status === 'ready' ? state.candles.at(-2) : null
  const movement = candle && previous ? priceMovement(candle.close, previous.close) : null
  const move = movement ? movementFromChange(movement.rawChange) : 'flat'

  return (
    <div className="price-chart__legend" aria-live="polite">
      <span className="price-chart__market">
        <span>{market.baseTokenSymbol} Market Cap</span>
        <span>{interval}</span>
      </span>
      {candle ? (
        <dl className={`price-chart__ohlc price-chart__ohlc--${move}`}>
          <div><dt>O</dt><dd>{formatMarketCapUsd(candle.open)}</dd></div>
          <div><dt>H</dt><dd>{formatMarketCapUsd(candle.high)}</dd></div>
          <div><dt>L</dt><dd>{formatMarketCapUsd(candle.low)}</dd></div>
          <div><dt>C</dt><dd>{formatMarketCapUsd(candle.close)}</dd></div>
          {movement && (
            <div className="price-chart__change">
              <dt>CHG</dt>
              <dd>{formatSignedUsdChange(movement.rawChange)} ({formatSignedPercent(movement.percentChange)})</dd>
            </div>
          )}
        </dl>
      ) : (
        <span className="price-chart__muted">Waiting for candles</span>
      )}
    </div>
  )
}

function PriceChartStatus({ candleState, ethUsdPriceState, chartState }: { candleState: MarketCandleState; ethUsdPriceState: EthUsdPriceState; chartState: MarketCandleState }) {
  let status: Exclude<MarketCandleState['status'], 'ready'> | null = null
  let label = ''

  if (candleState.status === 'loading') {
    status = 'loading'
    label = 'Loading price history...'
  } else if (candleState.status === 'error') {
    status = 'error'
    label = candleState.message
  } else if (candleState.status === 'empty') {
    status = 'empty'
    label = 'No candles available.'
  } else if (ethUsdPriceState.status === 'loading') {
    status = 'loading'
    label = 'Loading ETH-USD spot price...'
  } else if (ethUsdPriceState.status === 'error') {
    status = 'error'
    label = ethUsdPriceState.message
  } else if (ethUsdPriceState.status === 'empty') {
    status = 'empty'
    label = 'No ETH-USD spot price available.'
  } else if (chartState.status === 'loading') {
    status = 'loading'
    label = 'Loading market cap scale...'
  } else if (chartState.status === 'error') {
    status = 'error'
    label = chartState.message
  } else if (chartState.status === 'empty') {
    status = 'empty'
    label = 'No market cap history available.'
  }

  if (!status) return null

  const role = status === 'error' ? 'alert' : 'status'

  return (
    <div className={`price-chart__status price-chart__status--${status}`} role={role}>
      <span>{label}</span>
    </div>
  )
}

export function PriceChart({ market, ethUsdPriceState, interval = DEFAULT_CANDLE_INTERVAL }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const fittedDataKeyRef = useRef<string | null>(null)
  const lastCandleRef = useRef<MarketCandle | null>(null)
  const chartThemeRef = useRef(DEFAULT_CHART_THEME)
  const { rawCandles, state: candleState } = useMarketCandles({
    repoId: market.repoId,
    interval,
    lookbackSeconds: DEFAULT_CHART_LOOKBACK_SECONDS,
  })
  const displayState = stateFromUsdConversion(candleState, ethUsdPriceState)
  const tokenState = useMarketToken({ tokenAddress: market.tokenAddress, chainId: market.chainId })
  const chartState = stateFromMarketCapConversion(displayState, tokenState)
  const tokenDecimals = tokenState.decimals.status === 'ready' ? tokenState.decimals.decimals : null
  const tokenSupply = tokenState.supply.status === 'ready' ? tokenState.supply.totalSupply : null
  const ethUsdPrice = ethUsdPriceState.status === 'ready' ? ethUsdPriceState.usdPrice : null

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const theme = readChartTheme(container)
    chartThemeRef.current = theme

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
        fontFamily: 'Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
        attributionLogo: true,
        panes: {
          separatorColor: theme.grid,
          separatorHoverColor: theme.grid,
          enableResize: false,
        },
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: {
        visible: true,
        alignLabels: true,
        entireTextOnly: true,
        borderColor: theme.grid,
        textColor: theme.text,
        ticksVisible: true,
        ensureEdgeTickMarksVisible: true,
        minimumWidth: PRICE_SCALE_MIN_WIDTH,
        scaleMargins: { top: 0.14, bottom: 0.08 },
        tickMarkDensity: 3,
      },
      timeScale: {
        borderColor: theme.grid,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 5,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: theme.background },
        horzLine: { color: theme.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: theme.background },
      },
      localization: {
        priceFormatter: formatMarketCapPointerValue,
        tickmarksPriceFormatter: formatMarketCapTickmarks,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: theme.up,
      downColor: theme.down,
      borderVisible: false,
      wickUpColor: theme.up,
      wickDownColor: theme.down,
      priceFormat: { type: 'custom', formatter: formatMarketCapPointerValue, tickmarksFormatter: formatMarketCapTickmarks, minMove: 0.01 },
      priceLineColor: theme.down,
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
      lastValueVisible: true,
    })
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: theme.volumeDown,
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1)

    chart.panes()[1]?.setHeight(84)

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const applyTheme = () => {
      const nextTheme = readChartTheme(container)
      chartThemeRef.current = nextTheme

      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: nextTheme.background },
          textColor: nextTheme.text,
          panes: {
            separatorColor: nextTheme.grid,
            separatorHoverColor: nextTheme.grid,
          },
        },
        grid: {
          vertLines: { color: nextTheme.grid },
          horzLines: { color: nextTheme.grid },
        },
        rightPriceScale: {
          borderColor: nextTheme.grid,
          textColor: nextTheme.text,
        },
        timeScale: {
          borderColor: nextTheme.grid,
        },
        crosshair: {
          vertLine: { color: nextTheme.crosshair, labelBackgroundColor: nextTheme.background },
          horzLine: { color: nextTheme.crosshair, labelBackgroundColor: nextTheme.background },
        },
      })
      candleSeries.applyOptions({
        upColor: nextTheme.up,
        downColor: nextTheme.down,
        wickUpColor: nextTheme.up,
        wickDownColor: nextTheme.down,
        priceLineColor: priceLineColor(lastCandleRef.current, nextTheme),
      })
      volumeSeries.applyOptions({ color: nextTheme.volumeDown })
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return

      chart.resize(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height))
    })
    resizeObserver.observe(container)

    const themeObserver = new MutationObserver(applyTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'style'] })
    const accentScope = container.closest('[data-accent]')
    if (accentScope && accentScope !== document.documentElement) {
      themeObserver.observe(accentScope, { attributes: true, attributeFilter: ['data-accent', 'style'] })
    }

    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const usdCandles = ethUsdPrice == null ? [] : toUsdCandles(rawCandles ?? [], ethUsdPrice) ?? []
    const candles = tokenSupply == null || tokenDecimals == null ? [] : toMarketCapCandles(usdCandles, tokenSupply, tokenDecimals) ?? []
    const lastCandle = candles.at(-1) ?? null
    const theme = chartThemeRef.current
    lastCandleRef.current = lastCandle

    candleSeriesRef.current?.setData(candles.map(toCandlestickData))
    candleSeriesRef.current?.applyOptions({ priceLineColor: priceLineColor(lastCandle, theme) })
    volumeSeriesRef.current?.setData(candles.map((candle) => toVolumeData(candle, tokenDecimals ?? 0, theme.volumeUp, theme.volumeDown)))

    if (!lastCandle) return

    const fitKey = `${market.repoId}:${interval}`
    if (fittedDataKeyRef.current === fitKey) return

    chartRef.current?.timeScale().fitContent()
    fittedDataKeyRef.current = fitKey
  }, [rawCandles, tokenDecimals, tokenSupply, ethUsdPrice, interval, market.repoId])

  return (
    <section className="price-chart" aria-label={`${market.baseTokenSymbol} market cap chart`}>
      <div className="price-chart__surface">
        <div ref={containerRef} className="price-chart__canvas" />
        <PriceChartLegend market={market} interval={interval} state={chartState} />
        <PriceChartStatus candleState={candleState} ethUsdPriceState={ethUsdPriceState} chartState={chartState} />
      </div>
    </section>
  )
}
