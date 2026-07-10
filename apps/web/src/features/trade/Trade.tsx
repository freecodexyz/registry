import { TokenSwapWidget } from './TokenSwapWidget'
import { TradeViewSwitcher, type TradeView } from './TradeViewSwitcher'

const TRADE_VIEWS: readonly TradeView[] = [
  {
    id: 'swap',
    label: 'Swap',
    render: () => <TokenSwapWidget />,
  },
]

export function Trade() {
  return (
    <main className="trade" data-accent="emerald" aria-label="Trade">
      <TradeViewSwitcher views={TRADE_VIEWS} />
    </main>
  )
}
