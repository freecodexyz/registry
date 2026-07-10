import { useReducer, useState, type FormEvent } from 'react'
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
  type CreateSwapJobInput,
  type SwapJob,
  type TradableAsset,
} from './tradeApi'
import { readQuoteOutputAmount, readQuoteInputUsd, readQuoteOutputUsd } from './tradeQuote'
import {
  initialSwapWorkflow,
  isBusyWorkflow,
  swapFromWorkflow,
  swapReadyWorkflow,
  swapWorkflowReducer,
  type SwapWorkflow,
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
import { balanceKey, useTokenBalances, type TokenBalanceState } from './useTokenBalance'

export function TokenSwapWidget() {
  const { address, connector } = useAccount()
  const { isSignedIn } = useAuthSession()
  const [sellAddress, setSellAddress] = useState<string | null>(null)
  const [buyAddress, setBuyAddress] = useState<string | null>(null)
  const [sellAmountInput, setSellAmountInput] = useState('')
  const [workflow, dispatch] = useReducer(swapWorkflowReducer, initialSwapWorkflow)
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
  const tokenBalances = useTokenBalances(address, assets, supportedBalanceChainId, isSignedIn)
  const sellBalance = readTokenBalance(tokenBalances, sellAsset)
  const buyBalance = readTokenBalance(tokenBalances, buyAsset)
  const sellAmount = sellAsset ? parseSellAmount(sellAmountInput, sellAsset.decimals) : null
  const hasSameAsset = isSameAddress(sellAsset?.address ?? null, buyAsset?.address ?? null)
  const hasInsufficientSellBalance = isAmountGreaterThanBalance(sellAmount, sellBalance.amount)
  const quoteInput = createQuoteInput({
    isSignedIn,
    address,
    sellAsset,
    buyAsset,
    sellAmount,
    swapChainId,
    hasSameAsset,
    hasInsufficientSellBalance,
    assetsStatus: assetsQuery.status,
  })
  const quoteQuery = useQuery({
    queryKey: [
      'trade-swap-quote',
      quoteInput?.chainId ?? null,
      quoteInput?.tokenIn ?? null,
      quoteInput?.tokenOut ?? null,
      quoteInput?.amount ?? null,
      quoteInput?.swapper ?? null,
      quoteInput?.slippageTolerance ?? null,
    ],
    queryFn: async ({ signal }) => {
      if (!quoteInput) throw new Error('quote input unavailable')
      const swap = await createSwapJob(quoteInput, signal)
      return await pollSwap(swap, signal)
    },
    enabled: quoteInput !== null,
  })
  const activeWorkflow = workflow.status === 'idle' && quoteInput
    ? quoteWorkflowFromQuery(quoteQuery.status, quoteQuery.error, quoteQuery.data)
    : workflow
  const currentSwap = swapFromWorkflow(activeWorkflow)
  const buyAmountInput = buyAsset ? formatBaseUnitAmount(readQuoteOutputAmount(currentSwap), buyAsset.decimals) : ''
  const sellUsdValue = formatUsdValue(readQuoteInputUsd(currentSwap))
  const buyUsdValue = formatUsdValue(readQuoteOutputUsd(currentSwap))
  const canSubmit = Boolean(
    isSignedIn &&
    address &&
    connector &&
    sellAsset &&
    buyAsset &&
    sellAmount &&
    swapChainId &&
    !hasSameAsset &&
    !hasInsufficientSellBalance &&
    assetsQuery.status === 'success' &&
    (activeWorkflow.status === 'action_required' || activeWorkflow.status === 'ready_to_sign'),
  )
  const visibleWorkflow = visibleSwapWorkflow(activeWorkflow, assetsQuery.status, assetsQuery.error, isSignedIn, assets.length > 0, hasSameAsset, hasInsufficientSellBalance)

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
    if (hasInsufficientSellBalance) {
      dispatch({ type: 'failed', message: 'Insufficient balance' })
      return
    }

    try {
      if (activeWorkflow.status === 'action_required') {
        await completeRequiredAction(activeWorkflow.swap, address)
        return
      }

      if (activeWorkflow.status === 'ready_to_sign') {
        await submitSwapTransaction(activeWorkflow.swap)
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
          balances={tokenBalances}
          token={sellAsset}
          metadata={sellUsdValue}
          balance={sellBalance.label}
          onAmountChange={handleAmountChange}
          onTokenChange={handleSellTokenChange}
        />
        <SwapDirectionButton onSwap={handleDirectionSwap} disabled={assets.length < 2 || isBusyWorkflow(visibleWorkflow)} />
        <TokenAmountInput
          label="Buy"
          amount={buyAmountInput}
          assets={assets}
          balances={tokenBalances}
          token={buyAsset}
          metadata={buyUsdValue}
          balance={buyBalance.label}
          readOnly
          onTokenChange={handleBuyTokenChange}
        />
        <SwapRouteStatus workflow={visibleWorkflow} sellAsset={sellAsset} buyAsset={buyAsset} chainId={swapChainId} />
        <SwapActionButton workflow={visibleWorkflow} disabled={!canSubmit} />
      </form>
    </Card>
  )
}

const UNKNOWN_BALANCE: TokenBalanceState = { label: '--', amount: null }

function readTokenBalance(balances: Record<string, TokenBalanceState>, asset: TradableAsset | null) {
  return asset ? balances[balanceKey(asset.address)] ?? UNKNOWN_BALANCE : UNKNOWN_BALANCE
}

function isAmountGreaterThanBalance(amount: string | null, balance: string | null) {
  if (!amount || !balance) return false

  try {
    return BigInt(amount) > BigInt(balance)
  } catch {
    return false
  }
}

function createQuoteInput({
  isSignedIn,
  address,
  sellAsset,
  buyAsset,
  sellAmount,
  swapChainId,
  hasSameAsset,
  hasInsufficientSellBalance,
  assetsStatus,
}: {
  isSignedIn: boolean;
  address: Address | undefined;
  sellAsset: TradableAsset | null;
  buyAsset: TradableAsset | null;
  sellAmount: string | null;
  swapChainId: number | null;
  hasSameAsset: boolean;
  hasInsufficientSellBalance: boolean;
  assetsStatus: 'pending' | 'error' | 'success';
}): CreateSwapJobInput | null {
  if (!isSignedIn || !address || !sellAsset || !buyAsset || !sellAmount || !swapChainId || hasSameAsset || hasInsufficientSellBalance || assetsStatus !== 'success') return null

  return {
    chainId: swapChainId,
    tokenIn: sellAsset.address,
    tokenOut: buyAsset.address,
    amount: sellAmount,
    swapper: address,
    slippageTolerance: SLIPPAGE_TOLERANCE,
  }
}

function quoteWorkflowFromQuery(status: 'pending' | 'error' | 'success', error: Error | null, swap: SwapJob | undefined): SwapWorkflow {
  if (status === 'pending') return { status: 'submitting', message: 'Requesting route' }
  if (status === 'error') return { status: 'failed', message: errorMessage(error) }
  if (swap) return swapReadyWorkflow(swap)

  return { status: 'failed', message: 'Swap quote unavailable' }
}
