import { useId, useReducer, useState, type ChangeEvent, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sendTransaction, signTypedData, waitForTransactionReceipt } from 'wagmi/actions'
import { FiArrowDown } from 'react-icons/fi'
import { erc20Abi, formatUnits, parseUnits, type Address, type Hex } from 'viem'
import type { TypedDataDomain } from 'viem'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { Button, Card, Select, SpecRow, Specs } from '@freecodexyz/ui'
import { wagmiConfig } from '../../app/wagmi'
import { useAuthSession } from '../auth/useAuthSession'
import {
  createSwapJob,
  loadSwapJob,
  loadTradableAssets,
  submitWalletAction,
  type SwapJob,
  type SwapTransactionRequest,
  type TradableAsset,
} from './tradeApi'

type SwapWorkflow =
  | { status: 'idle'; message: string }
  | { status: 'submitting'; message: string }
  | { status: 'polling'; message: string; swap: SwapJob }
  | { status: 'action_required'; message: string; swap: SwapJob }
  | { status: 'ready_to_sign'; message: string; swap: SwapJob }
  | { status: 'wallet_pending'; message: string; swap: SwapJob }
  | { status: 'submitted'; message: string; swap: SwapJob; txHash: Hex }
  | { status: 'confirmed'; message: string; swap: SwapJob; txHash: Hex }
  | { status: 'confirmation_unknown'; message: string; swap: SwapJob; txHash: Hex }
  | { status: 'failed'; message: string; swap?: SwapJob; txHash?: Hex }

type SwapWorkflowAction =
  | { type: 'reset'; message?: string }
  | { type: 'submitting' }
  | { type: 'polling'; swap: SwapJob }
  | { type: 'swap_ready'; swap: SwapJob }
  | { type: 'wallet_pending'; swap: SwapJob; message: string }
  | { type: 'submitted'; swap: SwapJob; txHash: Hex }
  | { type: 'confirmed'; swap: SwapJob; txHash: Hex }
  | { type: 'confirmation_unknown'; swap: SwapJob; txHash: Hex }
  | { type: 'failed'; message: string; swap?: SwapJob; txHash?: Hex }

const SLIPPAGE_TOLERANCE = 0.5
const POLL_INTERVAL_MS = 900
const POLL_ATTEMPTS = 40
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'
type SupportedSwapChainId = typeof base.id | typeof baseSepolia.id

function swapWorkflowReducer(_: SwapWorkflow, action: SwapWorkflowAction): SwapWorkflow {
  switch (action.type) {
    case 'reset':
      return { status: 'idle', message: action.message ?? 'Enter an amount' }
    case 'submitting':
      return { status: 'submitting', message: 'Requesting route' }
    case 'polling':
      return { status: 'polling', message: stageMessage(action.swap), swap: action.swap }
    case 'swap_ready':
      if (action.swap.status === 'action_required') return { status: 'action_required', message: actionMessage(action.swap), swap: action.swap }
      if (action.swap.status === 'completed') return { status: 'ready_to_sign', message: 'Swap transaction ready', swap: action.swap }
      if (action.swap.status === 'failed') return { status: 'failed', message: action.swap.error?.message ?? 'Swap failed', swap: action.swap }
      return { status: 'polling', message: stageMessage(action.swap), swap: action.swap }
    case 'wallet_pending':
      return { status: 'wallet_pending', message: action.message, swap: action.swap }
    case 'submitted':
      return { status: 'submitted', message: 'Confirming transaction', swap: action.swap, txHash: action.txHash }
    case 'confirmed':
      return { status: 'confirmed', message: 'Swap confirmed', swap: action.swap, txHash: action.txHash }
    case 'confirmation_unknown':
      return { status: 'confirmation_unknown', message: 'Confirmation pending', swap: action.swap, txHash: action.txHash }
    case 'failed':
      return { status: 'failed', message: action.message, swap: action.swap, txHash: action.txHash }
    default:
      return assertNever(action)
  }
}

function sanitizeDecimalInput(value: string): string {
  const decimalOnly = value.replace(/[^\d.]/g, '')
  const firstDecimal = decimalOnly.indexOf('.')

  if (firstDecimal === -1) return decimalOnly

  return `${decimalOnly.slice(0, firstDecimal + 1)}${decimalOnly.slice(firstDecimal + 1).replace(/\./g, '')}`
}

function formatTokenAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0'
  if (amount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (amount >= 1) return amount.toLocaleString('en-US', { maximumFractionDigits: 4 })

  return amount.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

function formatBaseUnitAmount(amount: string | null, decimals: number): string {
  if (!amount) return ''

  try {
    return formatTokenAmount(Number(formatUnits(BigInt(amount), decimals)))
  } catch {
    return ''
  }
}

function formatUsdValue(value: string | null): string {
  if (!value) return '--'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '--'

  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: amount < 1 ? 4 : 2 })
}

function parseSellAmount(value: string, decimals: number): string | null {
  if (!value || value === '.') return null

  try {
    const amount = parseUnits(value, decimals)
    return amount > 0n ? amount.toString() : null
  } catch {
    return null
  }
}

function assetByAddress(assets: readonly TradableAsset[], address: string | null): TradableAsset | null {
  if (address) {
    const selected = assets.find((asset) => asset.address.toLowerCase() === address.toLowerCase())
    if (selected) return selected
  }

  return assets[0] ?? null
}

function buyAssetByAddress(assets: readonly TradableAsset[], sellAsset: TradableAsset | null, address: string | null): TradableAsset | null {
  if (address) {
    const selected = assets.find((asset) => asset.address.toLowerCase() === address.toLowerCase())
    if (selected && selected.address.toLowerCase() !== sellAsset?.address.toLowerCase()) return selected
  }

  return assets.find((asset) => asset.address.toLowerCase() !== sellAsset?.address.toLowerCase()) ?? null
}

function useTokenBalance(account: Address | undefined, asset: TradableAsset | null, chainId: SupportedSwapChainId | null, isSignedIn: boolean): string {
  const isNative = asset ? isNativeToken(asset) : false
  const token = asset && !isNative ? asset.address : null
  const enabled = Boolean(isSignedIn && account && asset && chainId)
  const nativeBalanceQuery = useBalance({
    ...(account ? { address: account } : {}),
    ...(chainId ? { chainId } : {}),
    query: { enabled: enabled && isNative },
  })
  const tokenBalanceQuery = useReadContract({
    abi: erc20Abi,
    functionName: 'balanceOf',
    ...(token ? { address: token } : {}),
    ...(account ? { args: [account] as const } : {}),
    ...(chainId ? { chainId } : {}),
    query: { enabled: enabled && !isNative && Boolean(token) },
  })

  if (!asset || !account || !isSignedIn) return '--'
  if (!chainId) return 'Unsupported'
  if (isNative) {
    if (nativeBalanceQuery.isLoading) return 'Loading'
    if (nativeBalanceQuery.isError || !nativeBalanceQuery.data) return '--'
    return `${formatTokenAmount(Number(formatUnits(nativeBalanceQuery.data.value, asset.decimals)))} ${asset.symbol}`
  }

  if (tokenBalanceQuery.isLoading) return 'Loading'
  if (tokenBalanceQuery.isError || tokenBalanceQuery.data === undefined) return '--'
  return `${formatTokenAmount(Number(formatUnits(tokenBalanceQuery.data, asset.decimals)))} ${asset.symbol}`
}

function TokenAmountInput({
  label,
  amount,
  assets,
  token,
  metadata,
  balance,
  readOnly,
  onAmountChange,
  onTokenChange,
}: {
  label: string;
  amount: string;
  assets: readonly TradableAsset[];
  token: TradableAsset | null;
  metadata: string;
  balance: string;
  readOnly?: boolean;
  onAmountChange?: (amount: string) => void;
  onTokenChange: (address: Address) => void;
}) {
  const amountInputId = useId()
  const tokenSelectId = useId()

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    onAmountChange?.(sanitizeDecimalInput(event.currentTarget.value))
  }

  function handleTokenChange(event: ChangeEvent<HTMLSelectElement>) {
    onTokenChange(event.currentTarget.value as Address)
  }

  return (
    <section className="token-amount-input" aria-label={label}>
      <div className="token-amount-input__top">
        <label htmlFor={amountInputId}>{label}</label>
      </div>
      <div className="token-amount-input__control">
        <input
          id={amountInputId}
          className="token-amount-input__amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          readOnly={readOnly}
          value={amount}
          placeholder="0"
          onChange={handleAmountChange}
          aria-label={`${label} amount`}
        />
        <label className="token-amount-input__token" htmlFor={tokenSelectId}>
          <Select id={tokenSelectId} value={token?.address ?? ''} onChange={handleTokenChange} aria-label={`${label} token`}>
            {assets.map((swapToken) => (
              <option key={swapToken.address} value={swapToken.address}>{swapToken.symbol}</option>
            ))}
          </Select>
        </label>
      </div>
      <div className="token-amount-input__bottom">
        <span>{metadata}</span>
        <span>Balance <span className="token-swap-widget__number">{balance}</span></span>
      </div>
    </section>
  )
}

function SwapDirectionButton({ onSwap, disabled }: { onSwap: () => void; disabled: boolean }) {
  return (
    <Button className="token-swap-widget__direction" type="button" variant="ghost" icon aria-label="Swap direction" onClick={onSwap} disabled={disabled}>
      <FiArrowDown aria-hidden="true" focusable="false" />
    </Button>
  )
}

function SwapActionButton({ workflow, disabled }: { workflow: SwapWorkflow; disabled: boolean }) {
  const label = actionButtonLabel(workflow)
  const txHash = txHashFromWorkflow(workflow)

  return (
    <Button className="token-swap-widget__action" type="submit" variant="dark" disabled={disabled || isBusyWorkflow(workflow) || isTerminalTxWorkflow(workflow)} block>
      <span>{label}</span>
      {txHash && <span>{shortHash(txHash)}</span>}
    </Button>
  )
}

function SwapRouteStatus({ workflow, sellAsset, buyAsset, chainId }: { workflow: SwapWorkflow; sellAsset: TradableAsset | null; buyAsset: TradableAsset | null; chainId: number | null }) {
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

export function TokenSwapWidget() {
  const { address, connector } = useAccount()
  const { isSignedIn } = useAuthSession()
  const [sellAddress, setSellAddress] = useState<string | null>(null)
  const [buyAddress, setBuyAddress] = useState<string | null>(null)
  const [sellAmountInput, setSellAmountInput] = useState('')
  const [workflow, dispatch] = useReducer(swapWorkflowReducer, { status: 'idle', message: 'Enter an amount' })
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
  const hasSameAsset = Boolean(sellAsset && buyAsset && sellAsset.address.toLowerCase() === buyAsset.address.toLowerCase())
  const canSubmit = Boolean(isSignedIn && address && connector && sellAsset && buyAsset && sellAmount && swapChainId && !hasSameAsset && assetsQuery.status === 'success')
  const visibleWorkflow = stateWithLoadMessage(workflow, assetsQuery.status, assetsQuery.error, isSignedIn, hasSameAsset)

  function handleDirectionSwap() {
    setSellAddress(buyAsset?.address ?? null)
    setBuyAddress(sellAsset?.address ?? null)
    dispatch({ type: 'reset', message: 'Enter an amount' })
  }

  function handleSellTokenChange(nextAddress: Address) {
    setSellAddress(nextAddress)
    dispatch({ type: 'reset', message: 'Enter an amount' })
  }

  function handleBuyTokenChange(nextAddress: Address) {
    setBuyAddress(nextAddress)
    dispatch({ type: 'reset', message: 'Enter an amount' })
  }

  function handleAmountChange(nextAmount: string) {
    setSellAmountInput(nextAmount)
    dispatch({ type: 'reset', message: nextAmount ? 'Review route' : 'Enter an amount' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!address || !connector || !sellAsset || !buyAsset || !sellAmount || !swapChainId) return

    try {
      if (workflow.status === 'action_required') {
        await completeRequiredAction(workflow.swap, address, connector)
        return
      }

      if (workflow.status === 'ready_to_sign') {
        await submitSwapTransaction(workflow.swap)
        return
      }

      dispatch({ type: 'submitting' })
      const swap = await createSwapJob({
        chainId: swapChainId,
        tokenIn: sellAsset.address,
        tokenOut: buyAsset.address,
        amount: sellAmount,
        swapper: address,
        slippageTolerance: SLIPPAGE_TOLERANCE,
      })
      const readySwap = await pollSwap(swap)
      dispatch({ type: 'swap_ready', swap: readySwap })
    } catch (err) {
      dispatch({ type: 'failed', message: errorMessage(err) })
    }
  }

  async function completeRequiredAction(swap: SwapJob, account: Address, activeConnector: NonNullable<typeof connector>) {
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
    const signature = await signPermitData(activeConnector, account, action.permitData)
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

async function pollSwap(initial: SwapJob): Promise<SwapJob> {
  let swap = initial

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (swap.status === 'action_required' || swap.status === 'completed' || swap.status === 'failed') return swap
    await sleep(POLL_INTERVAL_MS)
    swap = await loadSwapJob(swap.id)
  }

  return swap
}

async function sendAndWaitForWalletTransaction(transaction: SwapTransactionRequest): Promise<Hex> {
  const chainId = readSupportedSwapChainId(transaction.chainId)
  const txHash = await sendWalletTransaction(transaction)
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId })
  if (receipt.status === 'reverted') throw new Error('wallet transaction reverted')
  return txHash
}

async function sendWalletTransaction(transaction: SwapTransactionRequest): Promise<Hex> {
  const chainId = readSupportedSwapChainId(transaction.chainId)

  const baseRequest = {
    chainId,
    to: transaction.to,
    data: transaction.data,
    value: parseQuantity(transaction.value),
  }
  const gas = transaction.gasLimit ? parseQuantity(transaction.gasLimit) : null

  if (transaction.gasPrice) {
    const legacyRequest = {
      ...baseRequest,
      type: 'legacy' as const,
      gasPrice: parseQuantity(transaction.gasPrice),
      ...(gas == null ? {} : { gas }),
    }
    return await sendTransaction(wagmiConfig, legacyRequest)
  }

  const eip1559Request = {
    ...baseRequest,
    ...(gas == null ? {} : { gas }),
    ...(transaction.maxFeePerGas ? { maxFeePerGas: parseQuantity(transaction.maxFeePerGas) } : {}),
    ...(transaction.maxPriorityFeePerGas ? { maxPriorityFeePerGas: parseQuantity(transaction.maxPriorityFeePerGas) } : {}),
  }

  return await sendTransaction(wagmiConfig, eip1559Request)
}

async function signPermitData(_: NonNullable<ReturnType<typeof useAccount>['connector']>, account: Address, permitData: unknown): Promise<Hex> {
  const typedData = parsePermitTypedData(permitData)

  return await signTypedData(wagmiConfig, {
    account,
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  })
}

function parsePermitTypedData(value: unknown): { domain: TypedDataDomain; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> } {
  const record = unwrapPermitTypedData(readRecord(value, 'permitData'))
  const message = isRecord(record.message) ? record.message : isRecord(record.values) ? record.values : null
  if (!isRecord(record.domain)) throw new Error('invalid permit domain')
  if (!isRecord(record.types)) throw new Error('invalid permit types')
  if (!message) throw new Error('invalid permit message')
  const primaryType = typeof record.primaryType === 'string' ? record.primaryType : inferPermitPrimaryType(record.types, message)

  return {
    domain: record.domain as TypedDataDomain,
    types: record.types,
    primaryType,
    message,
  }
}

function unwrapPermitTypedData(record: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(record.typedData)) return record.typedData
  if (isRecord(record.eip712)) return record.eip712
  if (isRecord(record.data)) return record.data

  return record
}

function inferPermitPrimaryType(types: Record<string, unknown>, message: Record<string, unknown>): string {
  if ('details' in message && 'spender' in message && 'sigDeadline' in message) {
    return Array.isArray(message.details) ? 'PermitBatch' : 'PermitSingle'
  }

  if ('permitted' in message && 'spender' in message && 'nonce' in message && 'deadline' in message) {
    return Array.isArray(message.permitted) ? 'PermitBatchTransferFrom' : 'PermitTransferFrom'
  }

  const preferred = ['PermitSingle', 'PermitBatch', 'PermitTransferFrom', 'PermitBatchTransferFrom'].find((typeName) => typeName in types)
  if (preferred) return preferred

  const candidates = Object.keys(types).filter((typeName) => !['EIP712Domain', 'PermitDetails', 'TokenPermissions'].includes(typeName))
  if (candidates.length === 1 && candidates[0]) return candidates[0]

  throw new Error('invalid permit primary type')
}

function readQuoteInputAmount(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['input', 'amount']) ?? readNestedString(swap?.quote?.raw, ['quote', 'input', 'amount'])
}

function readQuoteOutputAmount(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['output', 'amount']) ?? readNestedString(swap?.quote?.raw, ['quote', 'output', 'amount'])
}

function readQuoteInputUsd(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['input', 'usd']) ?? readNestedString(swap?.quote?.raw, ['quote', 'input', 'usd'])
}

function readQuoteOutputUsd(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['output', 'usd']) ?? readNestedString(swap?.quote?.raw, ['quote', 'output', 'usd'])
}

function readNestedString(value: unknown, path: readonly string[]): string | null {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }

  return typeof current === 'string' && current ? current : null
}

function swapFromWorkflow(workflow: SwapWorkflow): SwapJob | null {
  switch (workflow.status) {
    case 'idle':
    case 'submitting':
    case 'failed':
      return 'swap' in workflow ? workflow.swap ?? null : null
    case 'polling':
    case 'action_required':
    case 'ready_to_sign':
    case 'wallet_pending':
    case 'submitted':
    case 'confirmed':
    case 'confirmation_unknown':
      return workflow.swap
    default:
      return assertNever(workflow)
  }
}

function stateWithLoadMessage(workflow: SwapWorkflow, assetsStatus: 'pending' | 'error' | 'success', error: Error | null, isSignedIn: boolean, hasSameAsset: boolean): SwapWorkflow {
  if (!isSignedIn) return { status: 'idle', message: 'Sign in to trade' }
  if (assetsStatus === 'pending') return { status: 'idle', message: 'Loading assets' }
  if (assetsStatus === 'error') return { status: 'failed', message: error?.message ?? 'Unable to load assets' }
  if (hasSameAsset) return { status: 'failed', message: 'Select a different token' }

  return workflow
}

function stageMessage(swap: SwapJob): string {
  switch (swap.stage) {
    case 'queued':
      return 'Route queued'
    case 'quoting':
      return 'Quoting route'
    case 'checking_approval':
      return 'Checking approval'
    case 'building_swap':
      return 'Building swap transaction'
    case 'awaiting_wallet_action':
      return actionMessage(swap)
    case 'ready_to_sign':
      return 'Swap transaction ready'
    case 'failed':
      return swap.error?.message ?? 'Swap failed'
    default:
      return assertNever(swap.stage)
  }
}

function actionMessage(swap: SwapJob): string {
  const action = swap.requiredActions.find((requiredAction) => !requiredAction.fulfilled)
  if (!action) return 'Wallet action complete'
  if (action.type === 'approval') return 'Token approval required'

  return 'Permit signature required'
}

function actionButtonLabel(workflow: SwapWorkflow): string {
  switch (workflow.status) {
    case 'idle':
      return workflow.message
    case 'submitting':
    case 'polling':
    case 'wallet_pending':
      return workflow.message
    case 'action_required': {
      const action = workflow.swap.requiredActions.find((requiredAction) => !requiredAction.fulfilled)
      if (action?.type === 'approval') return 'Approve Token'
      if (action?.type === 'permit') return 'Sign Permit'
      return 'Continue'
    }
    case 'ready_to_sign':
      return 'Confirm Swap'
    case 'submitted':
      return 'Confirming'
    case 'confirmed':
      return 'Confirmed'
    case 'confirmation_unknown':
      return 'Pending'
    case 'failed':
      return workflow.message
    default:
      return assertNever(workflow)
  }
}

function isBusyWorkflow(workflow: SwapWorkflow): boolean {
  return workflow.status === 'submitting' || workflow.status === 'polling' || workflow.status === 'wallet_pending' || workflow.status === 'submitted'
}

function routeTone(workflow: SwapWorkflow): 'empty' | 'blocked' | 'ready' {
  if (workflow.status === 'failed') return 'blocked'
  if (workflow.status === 'ready_to_sign' || workflow.status === 'submitted' || workflow.status === 'confirmed' || workflow.status === 'confirmation_unknown') return 'ready'
  if (workflow.status === 'action_required') return 'ready'

  return 'empty'
}

function txHashFromWorkflow(workflow: SwapWorkflow): Hex | null {
  switch (workflow.status) {
    case 'submitted':
    case 'confirmed':
    case 'confirmation_unknown':
      return workflow.txHash
    case 'failed':
      return workflow.txHash ?? null
    case 'idle':
    case 'submitting':
    case 'polling':
    case 'action_required':
    case 'ready_to_sign':
    case 'wallet_pending':
      return null
    default:
      return assertNever(workflow)
  }
}

function isTerminalTxWorkflow(workflow: SwapWorkflow): boolean {
  return workflow.status === 'confirmed' || workflow.status === 'confirmation_unknown' || workflow.status === 'submitted'
}

function parseQuantity(value: string): bigint {
  return value.startsWith('0x') ? BigInt(value) : BigInt(value || '0')
}

function readSupportedSwapChainId(chainId: number): SupportedSwapChainId {
  if (chainId === base.id || chainId === baseSepolia.id) return chainId
  throw new Error(`unsupported chain ${chainId}`)
}

function readOptionalSupportedSwapChainId(chainId: number | null): SupportedSwapChainId | null {
  if (chainId === null) return null
  if (chainId === base.id || chainId === baseSepolia.id) return chainId
  return null
}

function isNativeToken(asset: TradableAsset): boolean {
  return asset.address.toLowerCase() === NATIVE_TOKEN_ADDRESS
}

function networkName(chainId: number | null): string {
  if (chainId === base.id) return 'Base'
  if (chainId === baseSepolia.id) return 'Base Sepolia'
  return 'Configured network'
}

function shortHash(hash: Hex): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Swap failed'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`invalid ${name}`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNever(value: never): never {
  throw new Error(`unhandled swap widget state: ${JSON.stringify(value)}`)
}
