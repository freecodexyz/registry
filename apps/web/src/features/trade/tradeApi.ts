import type { Address, Hex } from 'viem'

export type TradableAsset = {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  source: 'core' | 'market';
  repoId?: string;
  poolId?: Address;
}

export type TradableAssetsResponse = {
  chainId: number;
  assets: TradableAsset[];
}

export type SwapTransactionRequest = {
  to: Address;
  from: Address;
  data: Hex;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

export type RequiredSwapAction = {
  type: 'approval';
  approval: SwapTransactionRequest | null;
  cancel: SwapTransactionRequest | null;
  fulfilled: boolean;
  transactionHash?: Hex;
} | {
  type: 'permit';
  permitData: unknown;
  fulfilled: boolean;
}

export type SwapJobStatus = 'queued' | 'processing' | 'action_required' | 'completed' | 'failed'
export type SwapJobStage = 'queued' | 'checking_approval' | 'quoting' | 'awaiting_wallet_action' | 'building_swap' | 'ready_to_sign' | 'failed'

export type SwapJob = {
  id: string;
  status: SwapJobStatus;
  stage: SwapJobStage;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  request: {
    chainId: number;
    tokenIn: Address;
    tokenOut: Address;
    amount: string;
    swapper: Address;
    type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
    slippageTolerance: number;
    permitAmount: 'FULL' | 'EXACT';
    routingPreference: 'BEST_PRICE' | 'FASTEST';
  };
  requiredActions: readonly RequiredSwapAction[];
  approval?: unknown;
  quote?: {
    quote: unknown;
    permitData: unknown | null;
    routing: string | null;
    raw: unknown;
  };
  transaction?: SwapTransactionRequest;
  result?: unknown;
  error?: {
    code: string;
    message: string;
    retriable: boolean;
    details?: unknown;
  };
}

export type CreateSwapJobInput = {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amount: string;
  swapper: Address;
  slippageTolerance: number;
}

export type WalletActionEvidence = {
  approvalTransactionHash?: Hex;
  permitSignature?: Hex;
  approvalConfirmed?: true;
}

export async function loadTradableAssets(signal?: AbortSignal): Promise<TradableAssetsResponse> {
  const response = await fetch('/api/trade/assets', { credentials: 'include', signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseAssetsResponse(await response.json() as unknown)
}

export async function createSwapJob(input: CreateSwapJobInput): Promise<SwapJob> {
  const response = await fetch('/api/trade/swaps', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      type: 'EXACT_INPUT',
      permitAmount: 'FULL',
      routingPreference: 'BEST_PRICE',
    }),
  })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseSwapEnvelope(await response.json() as unknown)
}

export async function loadSwapJob(id: string, signal?: AbortSignal): Promise<SwapJob> {
  const response = await fetch(`/api/trade/swaps/${encodeURIComponent(id)}`, { credentials: 'include', signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseSwapEnvelope(await response.json() as unknown)
}

export async function submitWalletAction(id: string, evidence: WalletActionEvidence): Promise<SwapJob> {
  const response = await fetch(`/api/trade/swaps/${encodeURIComponent(id)}/actions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(evidence),
  })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseSwapEnvelope(await response.json() as unknown)
}

function parseAssetsResponse(value: unknown): TradableAssetsResponse {
  const record = readRecord(value, 'assets response')
  const chainId = readNumber(record.chainId, 'assets response.chainId')
  if (!Array.isArray(record.assets)) throw new Error('invalid assets response')
  const assets = record.assets.filter(isTradableAsset)
  if (assets.length === 0 && record.assets.length > 0) throw new Error('invalid assets response')

  return { chainId, assets }
}

function parseSwapEnvelope(value: unknown): SwapJob {
  const record = readRecord(value, 'swap response')
  return parseSwapJob(record.swap)
}

function parseSwapJob(value: unknown): SwapJob {
  const record = readRecord(value, 'swap')
  const status = readStringUnion(record.status, ['queued', 'processing', 'action_required', 'completed', 'failed'] as const, 'swap.status')
  const stage = readStringUnion(record.stage, ['queued', 'checking_approval', 'quoting', 'awaiting_wallet_action', 'building_swap', 'ready_to_sign', 'failed'] as const, 'swap.stage')
  const request = parseSwapRequest(record.request)
  const requiredActions = parseRequiredActions(record.requiredActions)

  const job: SwapJob = {
    id: readString(record.id, 'swap.id'),
    status,
    stage,
    createdAt: readString(record.createdAt, 'swap.createdAt'),
    updatedAt: readString(record.updatedAt, 'swap.updatedAt'),
    attempts: readNumber(record.attempts, 'swap.attempts'),
    request,
    requiredActions,
  }

  if ('approval' in record) job.approval = record.approval
  if ('quote' in record) job.quote = parseQuoteResult(record.quote)
  if ('transaction' in record) job.transaction = parseTransaction(record.transaction, 'swap.transaction')
  if ('result' in record) job.result = record.result
  if ('error' in record) job.error = parseSwapError(record.error)

  return job
}

function parseSwapRequest(value: unknown): SwapJob['request'] {
  const record = readRecord(value, 'swap.request')
  return {
    chainId: readNumber(record.chainId, 'swap.request.chainId'),
    tokenIn: readAddress(record.tokenIn, 'swap.request.tokenIn'),
    tokenOut: readAddress(record.tokenOut, 'swap.request.tokenOut'),
    amount: readString(record.amount, 'swap.request.amount'),
    swapper: readAddress(record.swapper, 'swap.request.swapper'),
    type: readStringUnion(record.type, ['EXACT_INPUT', 'EXACT_OUTPUT'] as const, 'swap.request.type'),
    slippageTolerance: readNumber(record.slippageTolerance, 'swap.request.slippageTolerance'),
    permitAmount: readStringUnion(record.permitAmount, ['FULL', 'EXACT'] as const, 'swap.request.permitAmount'),
    routingPreference: readStringUnion(record.routingPreference, ['BEST_PRICE', 'FASTEST'] as const, 'swap.request.routingPreference'),
  }
}

function parseQuoteResult(value: unknown): NonNullable<SwapJob['quote']> {
  const record = readRecord(value, 'swap.quote')
  return {
    quote: record.quote,
    permitData: record.permitData ?? null,
    routing: record.routing == null ? null : readString(record.routing, 'swap.quote.routing'),
    raw: record.raw,
  }
}

function parseSwapError(value: unknown): NonNullable<SwapJob['error']> {
  const record = readRecord(value, 'swap.error')
  const error: NonNullable<SwapJob['error']> = {
    code: readString(record.code, 'swap.error.code'),
    message: readString(record.message, 'swap.error.message'),
    retriable: readBoolean(record.retriable, 'swap.error.retriable'),
  }
  if ('details' in record) error.details = record.details
  return error
}

function parseRequiredActions(value: unknown): readonly RequiredSwapAction[] {
  if (!Array.isArray(value)) throw new Error('invalid swap.requiredActions')

  return value.map(parseRequiredAction)
}

function parseRequiredAction(value: unknown): RequiredSwapAction {
  const record = readRecord(value, 'required action')
  const type = readStringUnion(record.type, ['approval', 'permit'] as const, 'required action.type')

  if (type === 'approval') {
    const action: RequiredSwapAction = {
      type,
      approval: record.approval == null ? null : parseTransaction(record.approval, 'required action.approval'),
      cancel: record.cancel == null ? null : parseTransaction(record.cancel, 'required action.cancel'),
      fulfilled: readBoolean(record.fulfilled, 'required action.fulfilled'),
    }
    if (record.transactionHash != null) action.transactionHash = readHex(record.transactionHash, 'required action.transactionHash')
    return action
  }

  return {
    type,
    permitData: record.permitData,
    fulfilled: readBoolean(record.fulfilled, 'required action.fulfilled'),
  }
}

function parseTransaction(value: unknown, name: string): SwapTransactionRequest {
  const record = readRecord(value, name)
  const transaction: SwapTransactionRequest = {
    to: readAddress(record.to, `${name}.to`),
    from: readAddress(record.from, `${name}.from`),
    data: readHex(record.data, `${name}.data`),
    value: readString(record.value, `${name}.value`),
    chainId: readNumber(record.chainId, `${name}.chainId`),
  }

  if (record.gasLimit != null) transaction.gasLimit = readString(record.gasLimit, `${name}.gasLimit`)
  if (record.maxFeePerGas != null) transaction.maxFeePerGas = readString(record.maxFeePerGas, `${name}.maxFeePerGas`)
  if (record.maxPriorityFeePerGas != null) transaction.maxPriorityFeePerGas = readString(record.maxPriorityFeePerGas, `${name}.maxPriorityFeePerGas`)
  if (record.gasPrice != null) transaction.gasPrice = readString(record.gasPrice, `${name}.gasPrice`)

  return transaction
}

function isTradableAsset(value: unknown): value is TradableAsset {
  if (!isRecord(value)) return false
  if (typeof value.chainId !== 'number' || !Number.isInteger(value.chainId)) return false
  if (typeof value.address !== 'string' || !isApiAddress(value.address)) return false
  if (typeof value.symbol !== 'string' || typeof value.name !== 'string') return false
  if (typeof value.decimals !== 'number' || !Number.isInteger(value.decimals)) return false
  if (value.source !== 'core' && value.source !== 'market') return false
  if (value.repoId != null && typeof value.repoId !== 'string') return false
  if (value.poolId != null && (typeof value.poolId !== 'string' || !isApiAddress(value.poolId))) return false

  return true
}

function readString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`invalid ${name}`)
  return value
}

function readNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`invalid ${name}`)
  return value
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`invalid ${name}`)
  return value
}

function readAddress(value: unknown, name: string): Address {
  if (typeof value !== 'string' || !isApiAddress(value)) throw new Error(`invalid ${name}`)
  return value
}

function isApiAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function readHex(value: unknown, name: string): Hex {
  if (typeof value !== 'string' || !value.startsWith('0x')) throw new Error(`invalid ${name}`)
  return value as Hex
}

function readStringUnion<const T extends readonly string[]>(value: unknown, options: T, name: string): T[number] {
  if (typeof value === 'string' && options.includes(value)) return value
  throw new Error(`invalid ${name}`)
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`invalid ${name}`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
