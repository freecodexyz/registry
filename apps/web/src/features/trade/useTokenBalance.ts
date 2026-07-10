import { erc20Abi, formatUnits, type Address } from 'viem'
import { useBalance, useReadContract } from 'wagmi'
import type { TradableAsset } from './tradeApi'
import { formatTokenAmount, isNativeToken, type SupportedSwapChainId } from './tradeUtils'

export function useTokenBalance(account: Address | undefined, asset: TradableAsset | null, chainId: SupportedSwapChainId | null, isSignedIn: boolean): string {
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
