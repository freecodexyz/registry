import { base, baseSepolia, sepolia } from 'wagmi/chains'

const EXPLORERS: Record<number, { name: string; baseUrl: string }> = {
  [sepolia.id]: { name: 'Sepolia', baseUrl: 'https://sepolia.etherscan.io' },
  [base.id]: { name: 'Base', baseUrl: 'https://basescan.org' },
  [baseSepolia.id]: { name: 'Base Sepolia', baseUrl: 'https://sepolia.basescan.org' },
}

function explorerFor(chainId: number) {
  return EXPLORERS[chainId] ?? EXPLORERS[sepolia.id]
}

export function chainLabel(chainId: number) {
  return explorerFor(chainId).name
}

export function explorerAddressUrl(chainId: number, address: string) {
  return `${explorerFor(chainId).baseUrl}/address/${address}`
}

export function explorerTxUrl(chainId: number, txHash: string) {
  return `${explorerFor(chainId).baseUrl}/tx/${txHash}`
}

export function explorerBlockUrl(chainId: number, blockNumber: number) {
  return `${explorerFor(chainId).baseUrl}/block/${blockNumber}`
}
