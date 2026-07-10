import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { waitForTransactionReceipt } from 'wagmi/actions'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { Card } from '@freecodexyz/ui'
import { wagmiConfig } from '../../app/wagmi'
import { useAuthSession } from '../auth/useAuthSession'
import { SwapActionButton, SwapDirectionButton, SwapRouteStatus } from './SwapControls'
import { TokenAmountInput } from './TokenAmountInput'
import {
  createSwapJob,
  loadTradableAssets,
  submitWalletAction,
  type SwapJob,
} from './tradeApi'
import { readQuoteOutputAmount, readQuoteInputUsd, readQuoteOutputUsd } from './tradeQuote'
import {
  initialSwapWorkflow,
  isBusyWorkflow,
  swapFromWorkflow,
  swapWorkflowReducer,
  visibleSwapWorkflow,
} from './tradeWorkflow'
import {
  pollSwap,
  sendAndWaitForWalletTransaction,
  sendWalletTransaction,
  signPermitData,
} from './tradeWallet'
import {
  SLIPPAGE_TOLERANCE,
  assetByAddress,
  buyAssetByAddress,
  errorMessage,
  formatBaseUnitAmount,
  formatUsdValue,
  isSameAddress,
  parseSellAmount,
  readOptionalSupportedSwapChainId,
  readSupportedSwapChainId,
} from './tradeUtils'
import { useTokenBalance } from './useTokenBalance'

export function TokenSwapWidget() {
  const { address, connector } = useAccount()
  const { isSignedIn } = useAuthSession()
  const [sellAddress, setSellAddress] = useState<string | null>(null)
  const [buyAddress, setBuyAddress] = useState<string | null>(null)
  const [sellAmountInput, setSellAmountInput] = useState('')
  const [workflow, dispatch] = useReducer(swapWorkflowReducer, initialSwapWorkflow)
  const quoteRequestRef = useRef(0)
  const assetsQuery = useQuery({
    queryKey: ['trade-assets', isSignedIn],
    queryFn: ({ signal }) => loadTradableAssets(signal),
    enabled: isSignedIn,
  })

  const assets = assetsQuery.data?.assets ?? []
  const swapChainId = assetsQuery.data?.chainId ?? null
  const sellAsset = assetByAddress(assets, sellAddress)
  const buyAsset = buyAssetByAddress(assets, sellAsset, buyAddress)
  const supportedBalanceChainId = readOptionalSupportedSwapChainId(swapChainId)
  const sellBalance = useTokenBalance(address, sellAsset, supportedBalanceChainId, isSignedIn)
  const buyBalance = useTokenBalance(address, buyAsset, supportedBalanceChainId, isSignedIn)
  const sellAmount = sellAsset ? parseSellAmount(sellAmountInput, sellAsset.decimals) : null
  const currentSwap = swapFromWorkflow(workflow)
  const buyAmountInput = buyAsset ? formatBaseUnitAmount(readQuoteOutputAmount(currentSwap), buyAsset.decimals) : ''
  const sellUsdValue = formatUsdValue(readQuoteInputUsd(currentSwap))
  const buyUsdValue = formatUsdValue(readQuoteOutputUsd(currentSwap))
  const hasSameAsset = isSameAddress(sellAsset?.address ?? null, buyAsset?.address ?? null)
  const canRequestQuote = Boolean(isSignedIn && address && sellAsset && buyAsset && sellAmount && swapChainId && !hasSameAsset && assetsQuery.status === 'success')
  const canSubmit = Boolean(
    isSignedIn &&
    address &&
    connector &&
    sellAsset &&
    buyAsset &&
    sellAmount &&
    swapChainId &&
    !hasSameAsset &&
    assetsQuery.status === 'success' &&
    (workflow.status === 'action_required' || workflow.status === 'ready_to_sign'),
  )
  const visibleWorkflow = visibleSwapWorkflow(workflow, assetsQuery.status, assetsQuery.error, isSignedIn, assets.length > 0, hasSameAsset)

  useEffect(() => {
    if (!canRequestQuote || !address || !sellAsset || !buyAsset || !sellAmount || !swapChainId) return

    const controller = new AbortController()
    const requestId = quoteRequestRef.current + 1
    const quoteInput = {
      chainId: swapChainId,
      tokenIn: sellAsset.address,
      tokenOut: buyAsset.address,
      amount: sellAmount,
      swapper: address,
      slippageTolerance: SLIPPAGE_TOLERANCE,
    }
    quoteRequestRef.current = requestId

    async function requestQuote() {
      try {
        dispatch({ type: 'submitting' })
        const swap = await createSwapJob(quoteInput, controller.signal)
        const readySwap = await pollSwap(swap, controller.signal)
        if (quoteRequestRef.current === requestId) dispatch({ type: 'swap_ready', swap: readySwap })
      } catch (err) {
        if (isAbortError(err)) return
        if (quoteRequestRef.current === requestId) dispatch({ type: 'failed', message: errorMessage(err) })
      }
    }

    void requestQuote()

    return () => {
      controller.abort()
    }
  }, [address, assetsQuery.status, buyAsset, canRequestQuote, hasSameAsset, isSignedIn, sellAmount, sellAsset, swapChainId])

  function resetRoute(message = 'Enter an amount') {
    dispatch({ type: 'reset', message })
  }

  function handleDirectionSwap() {
    setSellAddress(buyAsset?.address ?? null)
    setBuyAddress(sellAsset?.address ?? null)
    resetRoute()
  }

  function handleSellTokenChange(nextAddress: Address) {
    setSellAddress(nextAddress)
    resetRoute()
  }

  function handleBuyTokenChange(nextAddress: Address) {
    setBuyAddress(nextAddress)
    resetRoute()
  }

  function handleAmountChange(nextAmount: string) {
    setSellAmountInput(nextAmount)
    resetRoute(nextAmount ? 'Review route' : 'Enter an amount')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!address || !connector || !sellAsset || !buyAsset || !sellAmount || !swapChainId) return

    try {
      if (workflow.status === 'action_required') {
        await completeRequiredAction(workflow.swap, address)
        return
      }

      if (workflow.status === 'ready_to_sign') {
        await submitSwapTransaction(workflow.swap)
        return
      }

      return
    } catch (err) {
      dispatch({ type: 'failed', message: errorMessage(err) })
    }
  }

  async function completeRequiredAction(swap: SwapJob, account: Address) {
    const action = swap.requiredActions.find((requiredAction) => !requiredAction.fulfilled)
    if (!action) {
      const readySwap = await pollSwap(swap)
      dispatch({ type: 'swap_ready', swap: readySwap })
      return
    }

    if (action.type === 'approval') {
      const transaction = action.approval ?? action.cancel
      if (!transaction) throw new Error('approval transaction unavailable')
      dispatch({ type: 'wallet_pending', swap, message: 'Confirm approval in wallet' })
      const txHash = await sendAndWaitForWalletTransaction(transaction)
      const updatedSwap = await submitWalletAction(swap.id, { approvalTransactionHash: txHash })
      dispatch({ type: 'polling', swap: updatedSwap })
      dispatch({ type: 'swap_ready', swap: await pollSwap(updatedSwap) })
      return
    }

    dispatch({ type: 'wallet_pending', swap, message: 'Sign Permit2 approval' })
    const signature = await signPermitData(account, action.permitData)
    const updatedSwap = await submitWalletAction(swap.id, { permitSignature: signature })
    dispatch({ type: 'polling', swap: updatedSwap })
    dispatch({ type: 'swap_ready', swap: await pollSwap(updatedSwap) })
  }

  async function submitSwapTransaction(swap: SwapJob) {
    if (!swap.transaction) throw new Error('swap transaction unavailable')

    dispatch({ type: 'wallet_pending', swap, message: 'Confirm swap in wallet' })
    const chainId = readSupportedSwapChainId(swap.transaction.chainId)
    const txHash = await sendWalletTransaction(swap.transaction)
    dispatch({ type: 'submitted', swap, txHash })

    try {
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId })
      if (receipt.status === 'reverted') {
        dispatch({ type: 'failed', message: 'Swap transaction reverted', swap, txHash })
        return
      }

      dispatch({ type: 'confirmed', swap, txHash })
    } catch {
      dispatch({ type: 'confirmation_unknown', swap, txHash })
    }
  }

  return (
    <Card className="token-swap-widget" aria-label="Token swap">
      <form className="token-swap-widget__form" onSubmit={handleSubmit}>
        <TokenAmountInput
          label="Sell"
          amount={sellAmountInput}
          assets={assets}
          token={sellAsset}
          metadata={sellUsdValue}
          balance={sellBalance}
          onAmountChange={handleAmountChange}
          onTokenChange={handleSellTokenChange}
        />
        <SwapDirectionButton onSwap={handleDirectionSwap} disabled={assets.length < 2 || isBusyWorkflow(visibleWorkflow)} />
        <TokenAmountInput
          label="Buy"
          amount={buyAmountInput}
          assets={assets}
          token={buyAsset}
          metadata={buyUsdValue}
          balance={buyBalance}
          readOnly
          onTokenChange={handleBuyTokenChange}
        />
        <SwapRouteStatus workflow={visibleWorkflow} sellAsset={sellAsset} buyAsset={buyAsset} chainId={swapChainId} />
        <SwapActionButton workflow={visibleWorkflow} disabled={!canSubmit} />
      </form>
    </Card>
  )
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}
