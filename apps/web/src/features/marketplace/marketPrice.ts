import { useQuery } from '@tanstack/react-query'

const COINBASE_ETH_USD_SPOT_URL = 'https://api.coinbase.com/v2/prices/ETH-USD/spot'

export const ETH_USD_PRICE_REFETCH_INTERVAL_MS = 60_000

export type EthUsdPriceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; usdPrice: number }

type CoinbaseSpotPriceResponse = {
  data: {
    base: string;
    currency: string;
    amount: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCoinbaseSpotPriceResponse(value: unknown): value is CoinbaseSpotPriceResponse {
  if (!isRecord(value) || !isRecord(value.data)) return false

  return value.data.base === 'ETH' && value.data.currency === 'USD' && typeof value.data.amount === 'string'
}

function parseCoinbaseEthUsdSpotPrice(value: unknown): number {
  if (!isCoinbaseSpotPriceResponse(value)) throw new Error('invalid ETH-USD spot response')

  const usdPrice = Number(value.data.amount)
  if (!Number.isFinite(usdPrice) || usdPrice <= 0) throw new Error('invalid ETH-USD spot price')

  return usdPrice
}

async function loadEthUsdSpotPrice(signal: AbortSignal): Promise<number> {
  const response = await fetch(COINBASE_ETH_USD_SPOT_URL, { signal })
  if (!response.ok) throw new Error(`Coinbase returned ${response.status}`)

  return parseCoinbaseEthUsdSpotPrice(await response.json() as unknown)
}

function stateFromEthUsdPriceQuery(usdPrice: number | undefined, status: 'error' | 'pending' | 'success', error: Error | null): EthUsdPriceState {
  if (usdPrice != null) return { status: 'ready', usdPrice }
  if (status === 'pending') return { status: 'loading' }
  if (status === 'error') return { status: 'error', message: error?.message ?? 'Unable to load ETH-USD spot price' }

  return { status: 'empty' }
}

export function useEthUsdPrice(enabled: boolean): EthUsdPriceState {
  const priceQuery = useQuery({
    queryKey: ['eth-usd-spot-price'],
    queryFn: ({ signal }) => loadEthUsdSpotPrice(signal),
    enabled,
    refetchInterval: ETH_USD_PRICE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    staleTime: ETH_USD_PRICE_REFETCH_INTERVAL_MS / 2,
  })

  return stateFromEthUsdPriceQuery(priceQuery.data, priceQuery.status, priceQuery.error)
}
