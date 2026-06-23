import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './wagmi';
import './index.css'
import App from './App.tsx'
import { AuthSessionProvider } from './AuthSessionProvider'

const qc = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={qc}>
      <AuthSessionProvider>
        <App />
      </AuthSessionProvider>
    </QueryClientProvider>
  </WagmiProvider>
  </StrictMode>
)
