import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { AuthSessionContext } from './useAuthSession'
import { useSignIn } from './useSignIn'

type AuthError = {
  address: `0x${string}` | undefined;
  message: string;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const signInWithWallet = useSignIn()
  const attemptedSignInAddress = useRef<`0x${string}` | null>(null)
  const [signedInAddress, setSignedInAddress] = useState<`0x${string}` | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const isSignedIn = Boolean(address && signedInAddress?.toLowerCase() === address.toLowerCase())
  const errorMessage = error && error.address === address ? error.message : null

  useEffect(() => {
    const controller = new AbortController()

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: controller.signal,
        })

        if (response.status === 401) {
          setSignedInAddress(null)
          return
        }
        if (!response.ok) throw new Error('session check failed')

        const session = await response.json() as { address: `0x${string}` }
        setSignedInAddress(session.address)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setSignedInAddress(null)
      } finally {
        if (!controller.signal.aborted) setIsSessionLoading(false)
      }
    }

    void loadSession()

    return () => controller.abort()
  }, [])

  const signIn = useCallback(async () => {
    setError(null)
    setIsSigningIn(true)
    try {
      const session = await signInWithWallet()
      setSignedInAddress(session.address)
    } catch (err) {
      setError({ address, message: err instanceof Error ? err.message : 'sign-in failed' })
    } finally {
      setIsSigningIn(false)
    }
  }, [address, signInWithWallet])

  useEffect(() => {
    if (!isConnected || !address) {
      attemptedSignInAddress.current = null
      return
    }

    if (isSessionLoading || isSignedIn || isSigningIn || attemptedSignInAddress.current === address) return

    attemptedSignInAddress.current = address
    void signIn()
  }, [address, isConnected, isSessionLoading, isSignedIn, isSigningIn, signIn])

  async function signOut() {
    setError(null)
    setIsLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('logout failed')
      setSignedInAddress(null)
      disconnect()
    } catch (err) {
      setError({ address, message: err instanceof Error ? err.message : 'logout failed' })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <AuthSessionContext.Provider value={{
      signedInAddress,
      isSessionLoading,
      isSigningIn,
      isLoggingOut,
      isSignedIn,
      errorMessage,
      signIn,
      signOut,
    }}>
      {children}
    </AuthSessionContext.Provider>
  )
}
