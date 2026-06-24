import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Card, Slider, SpecRow, Specs, Tab, Tabs } from '@freecodexyz/ui'

const ORDER_SIDES = ['buy', 'sell'] as const

type OrderSide = (typeof ORDER_SIDES)[number]
type TokenRole = 'base' | 'quote'

export type OrderEntryMarket = {
  baseTokenSymbol: string;
  quoteTokenSymbol: string;
  quotePerBase: number;
}

export type OrderEntryBalances = {
  baseAvailable: number;
  quoteAvailable: number;
}

export type OrderEntryCosts = {
  slippageBps: number;
  feeBps: number;
}

export type OrderEntryOrder = {
  side: OrderSide;
  sizeToken: TokenRole;
  sizeAmount: number;
  baseAmount: number;
  quoteAmount: number;
  orderValue: number;
  outputAmount: number;
  outputTokenSymbol: string;
  feeAmount: number;
  feeTokenSymbol: string;
  slippageAmount: number;
  slippageTokenSymbol: string;
}

type OrderEntryProps = {
  market: OrderEntryMarket;
  balances: OrderEntryBalances;
  costs: OrderEntryCosts;
  onPlaceOrder?: (order: OrderEntryOrder) => void;
}

type SizeInputState =
  | { status: 'empty' }
  | { status: 'ready'; amount: number }

type SizeSelection =
  | { source: 'size'; input: string }
  | { source: 'percentage'; input: string }

function sideLabel(side: OrderSide) {
  return side === 'buy' ? 'Buy' : 'Sell'
}

function tokenSymbolForRole(market: OrderEntryMarket, tokenRole: TokenRole) {
  return tokenRole === 'base' ? market.baseTokenSymbol : market.quoteTokenSymbol
}

function availableForSide(side: OrderSide, market: OrderEntryMarket, balances: OrderEntryBalances) {
  return side === 'buy'
    ? { amount: balances.quoteAvailable, tokenSymbol: market.quoteTokenSymbol }
    : { amount: balances.baseAvailable, tokenSymbol: market.baseTokenSymbol }
}

function safePositiveNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function bpsToRate(bps: number) {
  return Number.isFinite(bps) && bps > 0 ? bps / 10_000 : 0
}

function sanitizeDecimalInput(value: string) {
  const decimalOnly = value.replace(/[^\d.]/g, '')
  const firstDecimal = decimalOnly.indexOf('.')

  if (firstDecimal === -1) return decimalOnly

  return `${decimalOnly.slice(0, firstDecimal + 1)}${decimalOnly.slice(firstDecimal + 1).replace(/\./g, '')}`
}

function parseSizeInput(value: string): SizeInputState {
  if (value === '' || value === '.') return { status: 'empty' }

  const amount = Number(value)
  return Number.isFinite(amount) ? { status: 'ready', amount } : { status: 'empty' }
}

function sanitizePercentageInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (digitsOnly === '') return ''

  return String(Math.min(100, Number(digitsOnly)))
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function formatPercentageInput(value: number) {
  return String(Math.round(clampPercentage(value)))
}

function formatSizeInputAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) return ''
  if (amount === 0) return '0'

  return amount.toFixed(8).replace(/\.?0+$/, '')
}

function maxSizeAmountForSelection(side: OrderSide, sizeToken: TokenRole, market: OrderEntryMarket, balances: OrderEntryBalances) {
  const quotePerBase = safePositiveNumber(market.quotePerBase)
  const available = safePositiveNumber(availableForSide(side, market, balances).amount)

  if (available === 0 || quotePerBase === 0) return 0
  if (side === 'buy') return sizeToken === 'quote' ? available : available / quotePerBase

  return sizeToken === 'base' ? available : available * quotePerBase
}

function sizeAmountForPercentage(side: OrderSide, sizeToken: TokenRole, percentage: number, market: OrderEntryMarket, balances: OrderEntryBalances) {
  return maxSizeAmountForSelection(side, sizeToken, market, balances) * (clampPercentage(percentage) / 100)
}

function percentageForSizeAmount(side: OrderSide, sizeToken: TokenRole, sizeAmount: number, market: OrderEntryMarket, balances: OrderEntryBalances) {
  const maxSizeAmount = maxSizeAmountForSelection(side, sizeToken, market, balances)
  if (maxSizeAmount === 0) return 0

  return clampPercentage((sizeAmount / maxSizeAmount) * 100)
}

function sizeInputForSelection(selection: SizeSelection, side: OrderSide, sizeToken: TokenRole, market: OrderEntryMarket, balances: OrderEntryBalances) {
  if (selection.source === 'size') return selection.input
  if (selection.input === '') return ''

  return formatSizeInputAmount(sizeAmountForPercentage(side, sizeToken, Number(selection.input), market, balances))
}

function percentageInputForSelection(selection: SizeSelection, side: OrderSide, sizeToken: TokenRole, market: OrderEntryMarket, balances: OrderEntryBalances) {
  if (selection.source === 'percentage') return selection.input

  const parsedSize = parseSizeInput(selection.input)
  if (parsedSize.status === 'empty') return '0'

  return formatPercentageInput(percentageForSizeAmount(side, sizeToken, parsedSize.amount, market, balances))
}

function preservePercentageSelection(selection: SizeSelection, side: OrderSide, sizeToken: TokenRole, market: OrderEntryMarket, balances: OrderEntryBalances): SizeSelection {
  if (selection.source === 'percentage') return selection
  if (parseSizeInput(selection.input).status === 'empty') return selection

  return { source: 'percentage', input: percentageInputForSelection(selection, side, sizeToken, market, balances) }
}

function calculateOrder(side: OrderSide, sizeToken: TokenRole, sizeAmount: number, market: OrderEntryMarket, costs: OrderEntryCosts) {
  const quotePerBase = safePositiveNumber(market.quotePerBase)
  if (quotePerBase === 0) return null

  const baseAmount = sizeToken === 'base' ? sizeAmount : sizeAmount / quotePerBase
  const quoteAmount = sizeToken === 'quote' ? sizeAmount : sizeAmount * quotePerBase
  const outputTokenSymbol = side === 'buy' ? market.baseTokenSymbol : market.quoteTokenSymbol
  const grossOutputAmount = side === 'buy' ? baseAmount : quoteAmount
  const feeRate = bpsToRate(costs.feeBps)
  const slippageRate = bpsToRate(costs.slippageBps)
  const reductionRate = Math.min(1, feeRate + slippageRate)
  const outputAmount = grossOutputAmount * (1 - reductionRate)

  return {
    side,
    sizeToken,
    sizeAmount,
    baseAmount,
    quoteAmount,
    orderValue: quoteAmount,
    outputAmount,
    outputTokenSymbol,
    feeAmount: grossOutputAmount * feeRate,
    feeTokenSymbol: outputTokenSymbol,
    slippageAmount: grossOutputAmount * slippageRate,
    slippageTokenSymbol: outputTokenSymbol,
  } satisfies OrderEntryOrder
}

function formatTokenAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const maximumFractionDigits = safeAmount > 0 && safeAmount < 1 ? 6 : 2

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(safeAmount)
}

function formatBpsPercent(bps: number) {
  const safeBps = Number.isFinite(bps) && bps > 0 ? bps : 0
  return (safeBps / 100).toFixed(2)
}

function isTokenRole(value: string): value is TokenRole {
  return value === 'base' || value === 'quote'
}

export function OrderEntry({ market, balances, costs, onPlaceOrder }: OrderEntryProps) {
  const sizeInputId = useId()
  const sizePercentTicksId = useId()
  const [side, setSide] = useState<OrderSide>('buy')
  const [sizeToken, setSizeToken] = useState<TokenRole>('base')
  const [sizeSelection, setSizeSelection] = useState<SizeSelection>({ source: 'size', input: '' })

  const activeAvailable = availableForSide(side, market, balances)
  const sizeInput = sizeInputForSelection(sizeSelection, side, sizeToken, market, balances)
  const sizePercentageInput = percentageInputForSelection(sizeSelection, side, sizeToken, market, balances)
  const selectedSizePercentage = clampPercentage(Number(sizePercentageInput))
  const parsedSize = parseSizeInput(sizeInput)
  const order = parsedSize.status === 'ready'
    ? calculateOrder(side, sizeToken, parsedSize.amount, market, costs)
    : null
  const spendAmount = order ? (side === 'buy' ? order.quoteAmount : order.baseAmount) : 0
  const hasTradableSize = order != null && order.sizeAmount > 0
  const hasAvailableBalance = spendAmount <= safePositiveNumber(activeAvailable.amount)
  const canPlaceOrder = hasTradableSize && hasAvailableBalance
  const buttonQuantity = order ? formatTokenAmount(order.outputAmount) : '0.00'
  const buttonTokenSymbol = order?.outputTokenSymbol ?? (side === 'buy' ? market.baseTokenSymbol : market.quoteTokenSymbol)

  function handleSideChange(nextSide: OrderSide) {
    setSizeSelection(preservePercentageSelection(sizeSelection, side, sizeToken, market, balances))
    setSide(nextSide)
  }

  function handleSizeInputChange(event: ChangeEvent<HTMLInputElement>) {
    setSizeSelection({ source: 'size', input: sanitizeDecimalInput(event.currentTarget.value) })
  }

  function handleSizeTokenChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!isTokenRole(event.currentTarget.value)) return

    setSizeSelection(preservePercentageSelection(sizeSelection, side, sizeToken, market, balances))
    setSizeToken(event.currentTarget.value)
  }

  function handleSizeSliderChange(event: ChangeEvent<HTMLInputElement>) {
    setSizeSelection({ source: 'percentage', input: formatPercentageInput(Number(event.currentTarget.value)) })
  }

  function handleSizePercentageChange(event: ChangeEvent<HTMLInputElement>) {
    setSizeSelection({ source: 'percentage', input: sanitizePercentageInput(event.currentTarget.value) })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order || !canPlaceOrder) return

    onPlaceOrder?.(order)
  }

  return (
    <Card className="order-entry">
      <form className="order-entry__form" onSubmit={handleSubmit}>
        <Tabs className="order-entry__tabs" aria-label="Order side">
          {ORDER_SIDES.map((orderSide) => (
            <Tab
              key={orderSide}
              selected={side === orderSide}
              onClick={() => handleSideChange(orderSide)}
            >
              {sideLabel(orderSide)}
            </Tab>
          ))}
        </Tabs>

        <p className="order-entry__available" aria-live="polite">
          <span>Available to Trade</span>
          <span className="order-entry__available-value">
            <span className="order-entry__numeric">{formatTokenAmount(activeAvailable.amount)}</span> {activeAvailable.tokenSymbol}
          </span>
        </p>

        <div className="order-entry__size-control">
          <label className="order-entry__size-label" htmlFor={sizeInputId}>Size</label>
          <input
            id={sizeInputId}
            className="order-entry__size-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={sizeInput}
            placeholder="0.00"
            onChange={handleSizeInputChange}
            aria-label="Order size"
          />
          <select
            className="order-entry__token-select"
            value={sizeToken}
            onChange={handleSizeTokenChange}
            aria-label="Size token"
          >
            <option value="base">{tokenSymbolForRole(market, 'base')}</option>
            <option value="quote">{tokenSymbolForRole(market, 'quote')}</option>
          </select>
        </div>

        <div className="order-entry__size-slider">
          <Slider
            min={0}
            max={100}
            step={1}
            list={sizePercentTicksId}
            value={selectedSizePercentage}
            onChange={handleSizeSliderChange}
            aria-label="Size percentage"
          />
          <datalist id={sizePercentTicksId}>
            <option value="25" />
            <option value="50" />
            <option value="75" />
            <option value="100" />
          </datalist>
          <span className="order-entry__percentage-control">
            <input
              className="order-entry__percentage-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={sizePercentageInput}
              onChange={handleSizePercentageChange}
              aria-label="Size percentage"
            />
            <span>%</span>
          </span>
        </div>

        <Specs className="order-entry__summary">
          <SpecRow label="Order Value">
            <span className="order-entry__numeric">{order ? formatTokenAmount(order.orderValue) : '0.00'}</span> {market.quoteTokenSymbol}
          </SpecRow>
          <SpecRow label="Slippage">
            <span className="order-entry__numeric">{order ? formatTokenAmount(order.slippageAmount) : '0.00'}</span> {order?.slippageTokenSymbol ?? buttonTokenSymbol} (<span className="order-entry__numeric">{formatBpsPercent(costs.slippageBps)}</span>%)
          </SpecRow>
          <SpecRow label="Fees">
            <span className="order-entry__numeric">{order ? formatTokenAmount(order.feeAmount) : '0.00'}</span> {order?.feeTokenSymbol ?? buttonTokenSymbol} (<span className="order-entry__numeric">{formatBpsPercent(costs.feeBps)}</span>%)
          </SpecRow>
        </Specs>

        <Button
          className="order-entry__submit"
          type="submit"
          variant={side === 'buy' ? 'accent' : 'danger'}
          disabled={!canPlaceOrder}
        >
          <span>{sideLabel(side)}</span>
          <span className="order-entry__submit-quantity"><span className="order-entry__numeric">{buttonQuantity}</span> {buttonTokenSymbol}</span>
        </Button>
      </form>
    </Card>
  )
}
