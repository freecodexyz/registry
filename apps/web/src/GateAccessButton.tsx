import { useState } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { Button } from '@freecodexyz/ui'
import { useAuthSession } from './useAuthSession'

export function GateAccessButton() {
  const { isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { isSigningIn, signIn } = useAuthSession()
  const [isOpen, setIsOpen] = useState(false)

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
        disabled={(!isConnected && connectors.length === 0) || isSigningIn}
      >
        Access the registry
      </button>
      {isOpen && !isConnected && (
        <div className="connect-menu__list gate-access-menu__list" role="menu">
          {connectors.map((connector) => (
            <Button key={connector.id} variant="ghost" size="sm" block role="menuitem" onClick={() => handleConnect(connector)}>
              {connector.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
