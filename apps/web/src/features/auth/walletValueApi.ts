import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'

export type WalletValueState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; dollars: string; cents: string }

type WalletValueResponse = {
  walletValue: {
    walletAddress: Address;
    totalUsd: string;
  };
}

export function useWalletDollarValue(address: Address | undefined, enabled: boolean): WalletValueState {
  const query = useQuery({
    queryKey: ['wallet-dollar-value', address?.toLowerCase() ?? null],
    queryFn: ({ signal }) => loadWalletValue(signal),
    enabled: Boolean(enabled && address),
    staleTime: 60_000,
  })

  if (!address || !enabled) return { status: 'idle' }
  if (query.status === 'pending') return { status: 'loading' }
  if (query.status === 'error') return { status: 'error' }

  return formatWalletValue(query.data.walletValue.totalUsd)
}

async function loadWalletValue(signal?: AbortSignal): Promise<WalletValueResponse> {
  const response = await fetch('/api/trade/wallet-value', { credentials: 'include', signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseWalletValueResponse(await response.json() as unknown)
}

function parseWalletValueResponse(value: unknown): WalletValueResponse {
  const record = readRecord(value, 'wallet value response')
  const walletValue = readRecord(record.walletValue, 'wallet value response.walletValue')
  return {
    walletValue: {
      walletAddress: readAddress(walletValue.walletAddress, 'wallet value response.walletValue.walletAddress'),
      totalUsd: readDecimalString(walletValue.totalUsd, 'wallet value response.walletValue.totalUsd'),
    },
  }
}

function formatWalletValue(value: string): WalletValueState {
  const [whole = '0', fraction = ''] = value.split('.')
  const amount = BigInt(whole)
  return {
    status: 'ready',
    dollars: amount.toLocaleString('en-US'),
    cents: fraction.padEnd(2, '0').slice(0, 2),
  }
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`invalid ${name}`)
  return value as Record<string, unknown>
}

function readAddress(value: unknown, name: string): Address {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`invalid ${name}`)
  return value as Address
}

function readDecimalString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[0-9]+(?:\.[0-9]+)?$/.test(value)) throw new Error(`invalid ${name}`)
  return value
}
