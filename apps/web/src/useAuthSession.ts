import { createContext, useContext } from 'react'

export type AuthSessionContextValue = {
  signedInAddress: `0x${string}` | null;
  isSessionLoading: boolean;
  isPreparingSignIn: boolean;
  isSignInReady: boolean;
  isSigningIn: boolean;
  isLoggingOut: boolean;
  isSignedIn: boolean;
  errorMessage: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

export function useAuthSession() {
  const value = useContext(AuthSessionContext)
  if (!value) throw new Error('useAuthSession must be used within AuthSessionProvider')
  return value
}
