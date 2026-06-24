import { useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { useAuthSession } from './useAuthSession'
import { WalletConnectorMenu } from './WalletConnectorMenu'

export function GateAccessButton() {
  const { isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { errorMessage, isPreparingSignIn, isSignInReady, isSignedIn, isSigningIn, signIn } = useAuthSession()
  const [isOpen, setIsOpen] = useState(false)
  const needsSignature = isConnected && !isSignedIn
  const label = isSigningIn
    ? 'Open wallet to sign'
    : isPreparingSignIn
      ? 'Preparing nonce'
      : needsSignature && isSignInReady
        ? 'Sign nonce to access'
        : needsSignature
          ? 'Nonce unavailable'
          : 'Access the registry'

  function handleConnect(connector: (typeof connectors)[number]) {
    setIsOpen(false)
    connect({ connector })
  }

  function handleAccess() {
    if (isConnected) {
      void signIn()
      return
    }

    setIsOpen((open) => !open)
  }

  return (
    <div
      className="gate-access-menu"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false)
      }}
    >
      <button
        id="gate-title"
        className="gate-access-button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleAccess}
        disabled={(!isConnected && connectors.length === 0) || isSigningIn || (needsSignature && !isSignInReady)}
      >
        {label}
      </button>
      {errorMessage && <p className="gate-access-error" role="alert">{errorMessage}</p>}
      <WalletConnectorMenu connectors={connectors} isOpen={isOpen && !isConnected} onConnect={handleConnect} className="connect-menu__list gate-access-menu__list" />
    </div>
  )
}
