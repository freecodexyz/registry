import { erc20Abi, formatUnits, type Address } from 'viem'
import { useBalance, useReadContracts } from 'wagmi'
import type { TradableAsset } from './tradeApi'
import { formatTokenAmount, isNativeToken, type SupportedSwapChainId } from './tradeUtils'

export type TokenBalanceState = {
  label: string;
  amount: string | null;
}

export type TokenBalanceMap = Record<string, TokenBalanceState>

const UNKNOWN_BALANCE: TokenBalanceState = { label: '--', amount: null }
const LOADING_BALANCE: TokenBalanceState = { label: 'Loading', amount: null }
const UNSUPPORTED_BALANCE: TokenBalanceState = { label: 'Unsupported', amount: null }

export function useTokenBalances(account: Address | undefined, assets: readonly TradableAsset[], chainId: SupportedSwapChainId | null, isSignedIn: boolean): TokenBalanceMap {
  const nativeAsset = assets.find(isNativeToken) ?? null
  const erc20Assets = assets.filter((asset) => !isNativeToken(asset))
  const erc20Contracts = account && chainId
    ? erc20Assets.map((asset) => ({
        abi: erc20Abi,
        address: asset.address,
        functionName: 'balanceOf',
        args: [account] as const,
        chainId,
      }))
    : []
  const nativeBalanceQuery = useBalance({
    ...(account ? { address: account } : {}),
    ...(chainId ? { chainId } : {}),
    query: { enabled: Boolean(isSignedIn && account && chainId && nativeAsset) },
  })
  const erc20BalanceQuery = useReadContracts({
    contracts: erc20Contracts,
    query: { enabled: Boolean(isSignedIn && account && chainId && erc20Contracts.length > 0) },
  })

  const balances: TokenBalanceMap = {}

  for (const asset of assets) {
    balances[balanceKey(asset.address)] = !account || !isSignedIn ? UNKNOWN_BALANCE : chainId ? UNKNOWN_BALANCE : UNSUPPORTED_BALANCE
  }

  if (!account || !isSignedIn || !chainId) return balances

  if (nativeAsset) {
    balances[balanceKey(nativeAsset.address)] = readNativeBalance(nativeAsset, nativeBalanceQuery.isLoading, nativeBalanceQuery.isError, nativeBalanceQuery.data)
  }

  for (const [index, asset] of erc20Assets.entries()) {
    balances[balanceKey(asset.address)] = readContractBalance(asset, erc20BalanceQuery.isLoading, erc20BalanceQuery.isError, erc20BalanceQuery.data, index)
  }

  return balances
}

export function useTokenBalance(account: Address | undefined, asset: TradableAsset | null, chainId: SupportedSwapChainId | null, isSignedIn: boolean): TokenBalanceState {
  const balances = useTokenBalances(account, asset ? [asset] : [], chainId, isSignedIn)
  return asset ? balances[balanceKey(asset.address)] ?? UNKNOWN_BALANCE : UNKNOWN_BALANCE
}

export function balanceKey(address: string): string {
  return address.toLowerCase()
}

function readNativeBalance(asset: TradableAsset, isLoading: boolean, isError: boolean, data: unknown): TokenBalanceState {
  if (isLoading) return LOADING_BALANCE
  if (isError || !isNativeBalanceData(data)) return UNKNOWN_BALANCE

  return {
    label: `${formatTokenAmount(Number(formatUnits(data.value, asset.decimals)))} ${asset.symbol}`,
    amount: data.value.toString(),
  }
}

function readContractBalance(asset: TradableAsset, isLoading: boolean, isError: boolean, data: unknown, index: number): TokenBalanceState {
  if (isLoading) return LOADING_BALANCE
  if (isError || !Array.isArray(data)) return UNKNOWN_BALANCE

  const value = data[index]
  if (isReadContractSuccess(value)) {
    return {
      label: `${formatTokenAmount(Number(formatUnits(value.result, asset.decimals)))} ${asset.symbol}`,
      amount: value.result.toString(),
    }
  }

  return UNKNOWN_BALANCE
}

function isNativeBalanceData(value: unknown): value is { value: bigint } {
  return typeof value === 'object' && value !== null && 'value' in value && typeof value.value === 'bigint'
}

function isReadContractSuccess(value: unknown): value is { status: 'success'; result: bigint } {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'success' && 'result' in value && typeof value.result === 'bigint'
}
