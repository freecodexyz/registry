import { useEffect, useRef } from 'react'
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
  DEFAULT_TOKEN_DECIMALS,
  formatChartUsdPrice,
  formatSignedPercent,
  formatSignedUsdChange,
  formatUsdPrice,
  movementFromChange,
  normalizedTokenVolume,
  priceMovement,
} from './marketNumbers'
const PRICE_SCALE_MIN_WIDTH = 88

export type PriceChartMarket = {
  repoId: string;
  baseTokenSymbol: string;
  quoteTokenSymbol: string;
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

function PriceChartLegend({ market, interval, state }: { market: PriceChartMarket; interval: CandleInterval; state: MarketCandleState }) {
  const candle = state.status === 'ready' ? state.candles.at(-1) : null
  const previous = state.status === 'ready' ? state.candles.at(-2) : null
  const movement = candle && previous ? priceMovement(candle.close, previous.close) : null
  const move = movement ? movementFromChange(movement.rawChange) : 'flat'

  return (
    <div className="price-chart__legend" aria-live="polite">
      <span className="price-chart__market">
        <span>{market.baseTokenSymbol}/USD</span>
        <span>{interval}</span>
        <span>ETH spot converted</span>
      </span>
      {candle ? (
        <dl className={`price-chart__ohlc price-chart__ohlc--${move}`}>
          <div><dt>O</dt><dd>{formatUsdPrice(candle.open)}</dd></div>
          <div><dt>H</dt><dd>{formatUsdPrice(candle.high)}</dd></div>
          <div><dt>L</dt><dd>{formatUsdPrice(candle.low)}</dd></div>
          <div><dt>C</dt><dd>{formatUsdPrice(candle.close)}</dd></div>
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

function PriceChartStatus({ candleState, ethUsdPriceState, displayState }: { candleState: MarketCandleState; ethUsdPriceState: EthUsdPriceState; displayState: MarketCandleState }) {
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
  } else if (displayState.status === 'error') {
    status = 'error'
    label = displayState.message
  } else if (displayState.status === 'empty') {
    status = 'empty'
    label = 'No USD price history available.'
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
  const chartColorsRef = useRef({
    up: '#00d6b4',
    down: '#ff4d57',
    volumeUp: 'rgba(0, 214, 180, 0.36)',
    volumeDown: 'rgba(255, 77, 87, 0.36)',
  })
  const decimals = market.baseTokenDecimals ?? DEFAULT_TOKEN_DECIMALS
  const { rawCandles, state: candleState } = useMarketCandles({
    repoId: market.repoId,
    interval,
    lookbackSeconds: DEFAULT_CHART_LOOKBACK_SECONDS,
  })
  const displayState = stateFromUsdConversion(candleState, ethUsdPriceState)
  const ethUsdPrice = ethUsdPriceState.status === 'ready' ? ethUsdPriceState.usdPrice : null

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
        priceFormatter: formatChartUsdPrice,
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
    const candles = ethUsdPrice == null ? [] : toUsdCandles(rawCandles ?? [], ethUsdPrice) ?? []
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
  }, [rawCandles, decimals, ethUsdPrice, interval, market.repoId])

  return (
    <section className="price-chart" aria-label={`${market.baseTokenSymbol}/USD price chart`}>
      <div className="price-chart__surface">
        <div ref={containerRef} className="price-chart__canvas" />
        <PriceChartLegend market={market} interval={interval} state={displayState} />
        <PriceChartStatus candleState={candleState} ethUsdPriceState={ethUsdPriceState} displayState={displayState} />
      </div>
    </section>
  )
}
