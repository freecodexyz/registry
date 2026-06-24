import { useCallback, useEffect, useReducer, useRef, type ReactNode } from 'react'
import { useAccount, useChainId, useDisconnect } from 'wagmi'
import { destroyAuthSession, loadAuthSession } from './authApi'
import { AuthSessionContext } from './useAuthSession'
import { isPreparedSignInMessageCurrent, SignInVerifyError, usePrepareSignInMessage, useSignIn, type PreparedSignInMessage } from './useSignIn'

type AuthAddress = `0x${string}`

type AuthError = {
  address: AuthAddress | undefined;
  message: string;
}

type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; signedInAddress: AuthAddress | null }

type SignInPreparationState =
  | { status: 'idle'; version: number; message: null }
  | { status: 'preparing'; version: number; message: null }
  | { status: 'ready'; version: number; message: PreparedSignInMessage }

type OperationState =
  | { status: 'idle' }
  | { status: 'running' }

type AuthSessionState = {
  session: SessionState;
  signInPreparation: SignInPreparationState;
  signIn: OperationState;
  logout: OperationState;
  error: AuthError | null;
}

type AuthSessionAction =
  | { type: 'sessionChecked'; address: AuthAddress | null }
  | { type: 'prepareSkipped' }
  | { type: 'prepareStarted' }
  | { type: 'prepareSucceeded'; message: PreparedSignInMessage }
  | { type: 'prepareFailed'; error: AuthError }
  | { type: 'signInStarted' }
  | { type: 'signInSucceeded'; address: AuthAddress }
  | { type: 'signInFailed'; error: AuthError; refreshNonce: boolean }
  | { type: 'logoutStarted' }
  | { type: 'logoutSucceeded' }
  | { type: 'logoutFailed'; error: AuthError }

const initialAuthSessionState: AuthSessionState = {
  session: { status: 'loading' },
  signInPreparation: { status: 'idle', version: 0, message: null },
  signIn: { status: 'idle' },
  logout: { status: 'idle' },
  error: null,
}

function idlePreparation(version: number): SignInPreparationState {
  return { status: 'idle', version, message: null }
}

function authSessionReducer(state: AuthSessionState, action: AuthSessionAction): AuthSessionState {
  switch (action.type) {
    case 'sessionChecked':
      return { ...state, session: { status: 'ready', signedInAddress: action.address } }
    case 'prepareSkipped':
      return { ...state, signInPreparation: idlePreparation(state.signInPreparation.version) }
    case 'prepareStarted':
      return { ...state, signInPreparation: { status: 'preparing', version: state.signInPreparation.version, message: null } }
    case 'prepareSucceeded':
      return { ...state, signInPreparation: { status: 'ready', version: state.signInPreparation.version, message: action.message }, error: null }
    case 'prepareFailed':
      return { ...state, signInPreparation: idlePreparation(state.signInPreparation.version), error: action.error }
    case 'signInStarted':
      return { ...state, signIn: { status: 'running' }, error: null }
    case 'signInSucceeded':
      return {
        ...state,
        session: { status: 'ready', signedInAddress: action.address },
        signInPreparation: idlePreparation(state.signInPreparation.version),
        signIn: { status: 'idle' },
        error: null,
      }
    case 'signInFailed':
      return {
        ...state,
        signInPreparation: idlePreparation(state.signInPreparation.version + (action.refreshNonce ? 1 : 0)),
        signIn: { status: 'idle' },
        error: action.error,
      }
    case 'logoutStarted':
      return { ...state, logout: { status: 'running' }, error: null }
    case 'logoutSucceeded':
      return {
        ...state,
        session: { status: 'ready', signedInAddress: null },
        signInPreparation: idlePreparation(state.signInPreparation.version),
        logout: { status: 'idle' },
        error: null,
      }
    case 'logoutFailed':
      return { ...state, logout: { status: 'idle' }, error: action.error }
  }
}

function errorMessageFor(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const { address, connector, isConnected } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const prepareSignInMessage = usePrepareSignInMessage()
  const signInWithWallet = useSignIn()
  const attemptedSignInAddress = useRef<`0x${string}` | null>(null)
  const signInPromise = useRef<Promise<void> | null>(null)
  const [state, dispatch] = useReducer(authSessionReducer, initialAuthSessionState)
  const signedInAddress = state.session.status === 'ready' ? state.session.signedInAddress : null
  const isSessionLoading = state.session.status === 'loading'
  const preparedSignInMessage = state.signInPreparation.status === 'ready' ? state.signInPreparation.message : null
  const prepareSignInVersion = state.signInPreparation.version
  const isPreparingSignIn = state.signInPreparation.status === 'preparing'
  const isSigningIn = state.signIn.status === 'running'
  const isLoggingOut = state.logout.status === 'running'
  const isSignedIn = Boolean(address && signedInAddress?.toLowerCase() === address.toLowerCase())
  const errorMessage = state.error && state.error.address === address ? state.error.message : null
  const isSignInReady = isPreparedSignInMessageCurrent(preparedSignInMessage, address, chainId, connector?.id)
  const canAutoSignIn = Boolean(connector && connector.id !== 'walletConnect')

  useEffect(() => {
    const controller = new AbortController()

    async function loadSession() {
      try {
        const session = await loadAuthSession(controller.signal)
        dispatch({ type: 'sessionChecked', address: session?.address ?? null })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        dispatch({ type: 'sessionChecked', address: null })
      }
    }

    void loadSession()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    if (!isConnected || !address || isSessionLoading || isSignedIn) {
      dispatch({ type: 'prepareSkipped' })
      return () => controller.abort()
    }

    dispatch({ type: 'prepareStarted' })

    void prepareSignInMessage(controller.signal)
      .then((message) => {
        if (!controller.signal.aborted) dispatch({ type: 'prepareSucceeded', message })
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        dispatch({ type: 'prepareFailed', error: { address, message: errorMessageFor(err, 'nonce request failed') } })
      })

    return () => controller.abort()
  }, [address, isConnected, isSessionLoading, isSignedIn, prepareSignInMessage, prepareSignInVersion])

  const signIn = useCallback(() => {
    if (signInPromise.current) return signInPromise.current

    const nextSignIn = (async () => {
      dispatch({ type: 'signInStarted' })
      try {
        const session = await signInWithWallet(isSignInReady ? preparedSignInMessage ?? undefined : undefined)
        dispatch({ type: 'signInSucceeded', address: session.address })
      } catch (err) {
        dispatch({
          type: 'signInFailed',
          error: { address, message: errorMessageFor(err, 'sign-in failed') },
          refreshNonce: err instanceof SignInVerifyError,
        })
      } finally {
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

  const signOut = useCallback(async () => {
    dispatch({ type: 'logoutStarted' })
    try {
      await destroyAuthSession()
      dispatch({ type: 'logoutSucceeded' })
      disconnect()
    } catch (err) {
      dispatch({ type: 'logoutFailed', error: { address, message: errorMessageFor(err, 'logout failed') } })
    }
  }, [address, disconnect])

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
