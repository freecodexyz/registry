import { base, baseSepolia } from 'wagmi/chains'
import { formatUnits, parseUnits, type Hex } from 'viem'
import type { TradableAsset } from './tradeApi'

export const SLIPPAGE_TOLERANCE = 0.5
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export type SupportedSwapChainId = typeof base.id | typeof baseSepolia.id

export function sanitizeDecimalInput(value: string): string {
  const decimalOnly = value.replace(/[^\d.]/g, '')
  const firstDecimal = decimalOnly.indexOf('.')

  if (firstDecimal === -1) return decimalOnly

  return `${decimalOnly.slice(0, firstDecimal + 1)}${decimalOnly.slice(firstDecimal + 1).replace(/\./g, '')}`
}

export function formatTokenAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0'
  if (amount >= 1000) return amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (amount >= 1) return amount.toLocaleString('en-US', { maximumFractionDigits: 4 })

  return amount.toLocaleString('en-US', { maximumFractionDigits: 8 })
}

export function formatBaseUnitAmount(amount: string | null, decimals: number): string {
  if (!amount) return ''

  try {
    return formatTokenAmount(Number(formatUnits(BigInt(amount), decimals)))
  } catch {
    return ''
  }
}

export function formatUsdValue(value: string | null): string {
  if (!value) return '--'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '--'

  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: amount < 1 ? 4 : 2 })
}

export function parseSellAmount(value: string, decimals: number): string | null {
  if (!value || value === '.') return null

  try {
    const amount = parseUnits(value, decimals)
    return amount > 0n ? amount.toString() : null
  } catch {
    return null
  }
}

export function assetByAddress(assets: readonly TradableAsset[], address: string | null): TradableAsset | null {
  if (address) {
    const selected = assets.find((asset) => isSameAddress(asset.address, address))
    if (selected) return selected
  }

  return assets[0] ?? null
}

export function buyAssetByAddress(assets: readonly TradableAsset[], sellAsset: TradableAsset | null, address: string | null): TradableAsset | null {
  if (address) {
    const selected = assets.find((asset) => isSameAddress(asset.address, address))
    if (selected && !isSameAddress(selected.address, sellAsset?.address ?? null)) return selected
  }

  return assets.find((asset) => !isSameAddress(asset.address, sellAsset?.address ?? null)) ?? null
}

export function isSameAddress(left: string | null, right: string | null): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase())
}

export function isNativeToken(asset: TradableAsset): boolean {
  return isSameAddress(asset.address, NATIVE_TOKEN_ADDRESS)
}

export function readSupportedSwapChainId(chainId: number): SupportedSwapChainId {
  if (chainId === base.id || chainId === baseSepolia.id) return chainId
  throw new Error(`unsupported chain ${chainId}`)
}

export function readOptionalSupportedSwapChainId(chainId: number | null): SupportedSwapChainId | null {
  if (chainId === null) return null
  if (chainId === base.id || chainId === baseSepolia.id) return chainId
  return null
}

export function networkName(chainId: number | null): string {
  if (chainId === base.id) return 'Base'
  if (chainId === baseSepolia.id) return 'Base Sepolia'
  return 'Configured network'
}

export function shortHash(hash: Hex): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Swap failed'
}

export function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`invalid ${name}`)
  return value
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function assertNever(value: never): never {
  throw new Error(`unhandled trade state: ${JSON.stringify(value)}`)
}
