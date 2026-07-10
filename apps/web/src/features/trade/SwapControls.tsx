import { FiArrowDown } from 'react-icons/fi'
import { Button, SpecRow, Specs } from '@freecodexyz/ui'
import type { TradableAsset } from './tradeApi'
import { readQuoteInputAmount, readQuoteOutputAmount } from './tradeQuote'
import {
  actionButtonLabel,
  isBusyWorkflow,
  isTerminalTxWorkflow,
  routeTone,
  swapFromWorkflow,
  txHashFromWorkflow,
  type SwapWorkflow,
} from './tradeWorkflow'
import { formatBaseUnitAmount, networkName, shortHash } from './tradeUtils'

export function SwapDirectionButton({ onSwap, disabled }: { onSwap: () => void; disabled: boolean }) {
  return (
    <Button className="token-swap-widget__direction" type="button" variant="ghost" icon aria-label="Swap direction" onClick={onSwap} disabled={disabled}>
      <FiArrowDown className="token-swap-widget__direction-icon" aria-hidden="true" focusable="false" />
    </Button>
  )
}

export function SwapActionButton({ workflow, disabled }: { workflow: SwapWorkflow; disabled: boolean }) {
  const label = actionButtonLabel(workflow)
  const txHash = txHashFromWorkflow(workflow)

  return (
    <Button className="token-swap-widget__action" type="submit" variant="dark" disabled={disabled || isBusyWorkflow(workflow) || isTerminalTxWorkflow(workflow)} block>
      <span>{label}</span>
      {txHash && <span>{shortHash(txHash)}</span>}
    </Button>
  )
}

export function SwapRouteStatus({ workflow, sellAsset, buyAsset, chainId }: { workflow: SwapWorkflow; sellAsset: TradableAsset | null; buyAsset: TradableAsset | null; chainId: number | null }) {
  const swap = swapFromWorkflow(workflow)
  const outputAmount = swap && buyAsset ? formatBaseUnitAmount(readQuoteOutputAmount(swap), buyAsset.decimals) : ''
  const inputAmount = swap && sellAsset ? formatBaseUnitAmount(readQuoteInputAmount(swap), sellAsset.decimals) : ''

  return (
    <Specs className="token-swap-widget__status" aria-live="polite">
      <SpecRow label="Route">
        <span className={`token-swap-widget__route token-swap-widget__route--${routeTone(workflow)}`}>{workflow.message}</span>
      </SpecRow>
      <SpecRow label="Rate">
        {inputAmount && outputAmount && sellAsset && buyAsset
          ? <>{inputAmount} {sellAsset.symbol} {'->'} <span className="token-swap-widget__number">{outputAmount}</span> {buyAsset.symbol}</>
          : 'Unavailable'}
      </SpecRow>
      <SpecRow label="Network + Protocol">
        {swap?.quote?.routing ?? `${networkName(chainId)} + Uniswap`}
      </SpecRow>
      <SpecRow label="Price Impact">
        {workflow.status === 'failed' ? 'Failed' : '--'}
      </SpecRow>
    </Specs>
  )
}
