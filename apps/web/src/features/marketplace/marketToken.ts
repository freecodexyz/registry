import { erc20Abi, type Address } from 'viem'
import { useReadContract } from 'wagmi'

const TOKEN_REFETCH_INTERVAL_MS = 60_000

export type MarketToken = {
  tokenAddress: Address;
  chainId: number;
}

export type TokenDecimalsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; decimals: number }

export type TokenSupplyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; totalSupply: bigint }

export type MarketTokenState = {
  decimals: TokenDecimalsState;
  supply: TokenSupplyState;
}

function parseTokenDecimals(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isInteger(value) || value < 0) return null

  return value
}

function parseTokenSupply(value: unknown): bigint | null {
  return typeof value === 'bigint' ? value : null
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useMarketToken({ tokenAddress, chainId }: MarketToken): MarketTokenState {
  const totalSupplyQuery = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'totalSupply',
    chainId,
    query: { refetchInterval: TOKEN_REFETCH_INTERVAL_MS },
  })
  const decimalsQuery = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
    chainId,
    query: { refetchInterval: TOKEN_REFETCH_INTERVAL_MS },
  })

  const decimals = parseTokenDecimals(decimalsQuery.data)
  const totalSupply = parseTokenSupply(totalSupplyQuery.data)

  return {
    decimals: decimalsQuery.status === 'error'
      ? { status: 'error', message: errorMessage(decimalsQuery.error, 'Unable to load token decimals') }
      : decimalsQuery.status === 'success'
        ? decimals == null
          ? { status: 'error', message: 'Token decimals response is invalid' }
          : { status: 'ready', decimals }
        : { status: 'loading' },
    supply: totalSupplyQuery.status === 'error'
      ? { status: 'error', message: errorMessage(totalSupplyQuery.error, 'Unable to load token supply') }
      : totalSupplyQuery.status === 'success'
        ? totalSupply == null
          ? { status: 'error', message: 'Token supply response is invalid' }
          : { status: 'ready', totalSupply }
        : { status: 'loading' },
  }
}
