import { sendTransaction, signTypedData, waitForTransactionReceipt } from 'wagmi/actions'
import type { Address, Hex } from 'viem'
import type { TypedDataDomain } from 'viem'
import { wagmiConfig } from '../../app/wagmi'
import { loadSwapJob, type SwapJob, type SwapTransactionRequest } from './tradeApi'
import { isRecord, readRecord, readSupportedSwapChainId } from './tradeUtils'

const POLL_INTERVAL_MS = 900
const POLL_ATTEMPTS = 40

export async function pollSwap(initial: SwapJob): Promise<SwapJob> {
  let swap = initial

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (swap.status === 'action_required' || swap.status === 'completed' || swap.status === 'failed') return swap
    await sleep(POLL_INTERVAL_MS)
    swap = await loadSwapJob(swap.id)
  }

  return swap
}

export async function sendAndWaitForWalletTransaction(transaction: SwapTransactionRequest): Promise<Hex> {
  const chainId = readSupportedSwapChainId(transaction.chainId)
  const txHash = await sendWalletTransaction(transaction)
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId })
  if (receipt.status === 'reverted') throw new Error('wallet transaction reverted')
  return txHash
}

export async function sendWalletTransaction(transaction: SwapTransactionRequest): Promise<Hex> {
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

export async function signPermitData(account: Address, permitData: unknown): Promise<Hex> {
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

function parseQuantity(value: string): bigint {
  return value.startsWith('0x') ? BigInt(value) : BigInt(value || '0')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
