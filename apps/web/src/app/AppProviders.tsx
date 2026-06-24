import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router'
import { WagmiProvider } from 'wagmi'
import { AuthSessionProvider } from '../features/auth/AuthSessionProvider'
import { wagmiConfig } from './wagmi'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </AuthSessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
