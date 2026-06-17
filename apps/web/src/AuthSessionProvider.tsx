import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAccount, useChainId, useDisconnect } from 'wagmi'
import { AuthSessionContext } from './useAuthSession'
import { isPreparedSignInMessageCurrent, SignInVerifyError, usePrepareSignInMessage, useSignIn, type PreparedSignInMessage } from './useSignIn'

type AuthError = {
  address: `0x${string}` | undefined;
  message: string;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const { address, connector, isConnected } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const prepareSignInMessage = usePrepareSignInMessage()
  const signInWithWallet = useSignIn()
  const attemptedSignInAddress = useRef<`0x${string}` | null>(null)
  const signInPromise = useRef<Promise<void> | null>(null)
  const [preparedSignInMessage, setPreparedSignInMessage] = useState<PreparedSignInMessage | null>(null)
  const [prepareSignInVersion, setPrepareSignInVersion] = useState(0)
  const [signedInAddress, setSignedInAddress] = useState<`0x${string}` | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [isPreparingSignIn, setIsPreparingSignIn] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const isSignedIn = Boolean(address && signedInAddress?.toLowerCase() === address.toLowerCase())
  const errorMessage = error && error.address === address ? error.message : null
  const isSignInReady = isPreparedSignInMessageCurrent(preparedSignInMessage, address, chainId, connector?.id)
  const canAutoSignIn = Boolean(connector && connector.id !== 'walletConnect')

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

  useEffect(() => {
    const controller = new AbortController()

    queueMicrotask(() => {
      if (controller.signal.aborted) return

      if (!isConnected || !address || isSessionLoading || isSignedIn) {
        setPreparedSignInMessage(null)
        setIsPreparingSignIn(false)
        return
      }

      setPreparedSignInMessage(null)
      setIsPreparingSignIn(true)

      void prepareSignInMessage(controller.signal)
        .then((message) => {
          if (controller.signal.aborted) return
          setPreparedSignInMessage(message)
          setError(null)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setPreparedSignInMessage(null)
          setError({ address, message: err instanceof Error ? err.message : 'nonce request failed' })
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsPreparingSignIn(false)
        })
    })

    return () => controller.abort()
  }, [address, isConnected, isSessionLoading, isSignedIn, prepareSignInMessage, prepareSignInVersion])

  const signIn = useCallback(() => {
    if (signInPromise.current) return signInPromise.current

    const nextSignIn = (async () => {
      setError(null)
      setIsSigningIn(true)
      try {
        const session = await signInWithWallet(isSignInReady ? preparedSignInMessage ?? undefined : undefined)
        setSignedInAddress(session.address)
        setPreparedSignInMessage(null)
      } catch (err) {
        setError({ address, message: err instanceof Error ? err.message : 'sign-in failed' })
        if (err instanceof SignInVerifyError) {
          setPreparedSignInMessage(null)
          setPrepareSignInVersion((version) => version + 1)
        }
      } finally {
        setIsSigningIn(false)
        signInPromise.current = null
      }
    })()

    signInPromise.current = nextSignIn
    return nextSignIn
  }, [address, isSignInReady, preparedSignInMessage, signInWithWallet])

  useEffect(() => {
    if (!isConnected || !address) {
      attemptedSignInAddress.current = null
      return
    }

    if (isSessionLoading || !isSignInReady || isSignedIn || isSigningIn || !canAutoSignIn || attemptedSignInAddress.current === address) return

    attemptedSignInAddress.current = address
    void signIn()
  }, [address, canAutoSignIn, isConnected, isSessionLoading, isSignInReady, isSignedIn, isSigningIn, signIn])

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
      setPreparedSignInMessage(null)
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
      isPreparingSignIn,
      isSignInReady,
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
