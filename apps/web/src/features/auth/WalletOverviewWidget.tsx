import { useEffect, useId, useRef, useState } from 'react'
import { FiCopy, FiCreditCard, FiExternalLink, FiPower, FiShield } from 'react-icons/fi'
import { useAccount, useChainId, useConnect } from 'wagmi'
import { Button, ButtonLink, Scrim } from '@freecodexyz/ui'
import { chainLabel, explorerAddressUrl } from '../../shared/explorers'
import { useAuthSession } from './useAuthSession'
import { useWalletDollarValue, type WalletValueState } from './walletValueApi'

type WalletOverviewWidgetProps = {
  collapsed?: boolean;
  placement?: 'modal' | 'inline' | 'floating';
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function triggerLabel(isConnected: boolean, address: string | undefined, isSessionLoading: boolean) {
  if (address && isConnected) return shortAddress(address)
  if (isSessionLoading) return 'Checking wallet'
  return 'Connect wallet'
}

export function WalletOverviewWidget({ collapsed = false, placement = 'modal' }: WalletOverviewWidgetProps) {
  const titleId = useId()
  const dialogId = useId()
  const accountMenuId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const copyResetTimeout = useRef<number | null>(null)
  const { address, connector, isConnected } = useAccount()
  const chainId = useChainId()
  const { connectors, connect } = useConnect()
  const {
    errorMessage,
    isPreparingSignIn,
    isSessionLoading,
    isSignInReady,
    isSignedIn,
    isSigningIn,
    isLoggingOut,
    signedInAddress,
    signIn,
    signOut,
  } = useAuthSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const displayAddress = isConnected ? (isSignedIn ? signedInAddress ?? address : address) : undefined
  const activeChainLabel = chainLabel(chainId)
  const walletValue = useWalletDollarValue(signedInAddress ?? address, Boolean(isConnected && isSignedIn))
  const hasConnectors = connectors.length > 0
  const canSignIn = isConnected && !isSignedIn && isSignInReady && !isSigningIn && !isPreparingSignIn
  const signInLabel = isSigningIn
    ? 'Open wallet'
    : isPreparingSignIn
      ? 'Preparing nonce'
      : 'Sign in'

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || placement !== 'inline') return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      setIsOpen(false)
      setIsAccountMenuOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, placement])

  useEffect(() => {
    return () => {
      if (copyResetTimeout.current != null) window.clearTimeout(copyResetTimeout.current)
    }
  }, [])

  function closeOverlay() {
    setIsOpen(false)
    setIsAccountMenuOpen(false)
  }

  function handleConnect(connector: (typeof connectors)[number]) {
    closeOverlay()
    connect({ connector })
  }

  function handleSignIn() {
    void signIn()
  }

  function handleSignOut() {
    void signOut().then(closeOverlay)
  }

  function handleSwitchWallet() {
    const switchConnector = connector ?? connectors[0]
    setIsAccountMenuOpen(false)
    if (switchConnector) connect({ connector: switchConnector })
  }

  function handleCopyAddress() {
    if (!displayAddress || !navigator.clipboard) return

    void navigator.clipboard.writeText(displayAddress)
      .then(() => {
        setCopyStatus('copied')
        if (copyResetTimeout.current != null) window.clearTimeout(copyResetTimeout.current)
        copyResetTimeout.current = window.setTimeout(() => setCopyStatus('idle'), 1800)
      })
      .catch(() => {
        setCopyStatus('failed')
        if (copyResetTimeout.current != null) window.clearTimeout(copyResetTimeout.current)
        copyResetTimeout.current = window.setTimeout(() => setCopyStatus('idle'), 1800)
      })
  }

  const widgetClassName = [
    'wallet-overview',
    collapsed ? 'wallet-overview--collapsed' : '',
    isOpen ? 'wallet-overview--open' : '',
    placement !== 'modal' ? `wallet-overview--${placement}` : '',
  ].filter(Boolean).join(' ')
  const dialogClassName = [
    'wallet-overview-dialog',
    `wallet-overview-dialog--${placement}`,
  ].join(' ')
  const overviewPanel = (
    <section
      id={dialogId}
      className={dialogClassName}
      role={placement === 'inline' ? 'region' : 'dialog'}
      aria-modal={placement === 'inline' ? undefined : true}
      aria-labelledby={titleId}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="wallet-overview-dialog__header">
        <div className="wallet-overview-dialog__headline">
          <div className="wallet-overview-dialog__identity">
            <span className="wallet-overview-dialog__avatar" aria-hidden="true">
              <FiCreditCard focusable="false" />
            </span>
            <h2 id={titleId}>{displayAddress ? shortAddress(displayAddress) : 'No wallet connected'}</h2>
          </div>
          <div
            className="wallet-overview-account-menu"
            onBlur={(event) => {
              const nextTarget = event.relatedTarget
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsAccountMenuOpen(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsAccountMenuOpen(false)
            }}
          >
            <button
              className="wallet-overview-account-menu__trigger"
              type="button"
              aria-label="Wallet account menu"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              aria-controls={isAccountMenuOpen ? accountMenuId : undefined}
              onClick={() => setIsAccountMenuOpen((open) => !open)}
            >
              <FiPower aria-hidden="true" focusable="false" />
            </button>
            {isAccountMenuOpen && (
              <div id={accountMenuId} className="connect-menu__list wallet-overview-account-menu__list" role="menu">
                <Button variant="ghost" size="sm" block role="menuitem" disabled={!isConnected || connectors.length === 0} onClick={handleSwitchWallet}>
                  Switch wallet
                </Button>
                <Button variant="ghost" size="sm" block role="menuitem" disabled={!isConnected || isLoggingOut} onClick={handleSignOut}>
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </div>
        {errorMessage && <p className="wallet-overview-dialog__error" role="alert">{errorMessage}</p>}
      </header>

      <section className="wallet-overview-balance" aria-label="Wallet balance">
        <WalletValueDisplay value={walletValue} />
      </section>

      <section className="wallet-overview-actions" aria-label="Wallet actions">
        <div className="wallet-overview-actions__rail">
          {!isConnected ? (
            connectors.map((connector) => (
              <Button
                key={connector.id}
                className="wallet-overview-action"
                variant="ghost"
                size="sm"
                icon
                aria-label={`Connect ${connector.name}`}
                title={connector.name}
                onClick={() => handleConnect(connector)}
              >
                <FiCreditCard aria-hidden="true" focusable="false" />
              </Button>
            ))
          ) : (
            <>
              {!isSignedIn && (
                <Button
                  className="wallet-overview-action"
                  variant="ghost"
                  size="sm"
                  icon
                  aria-label={signInLabel}
                  title={signInLabel}
                  disabled={!canSignIn}
                  onClick={handleSignIn}
                >
                  <FiShield aria-hidden="true" focusable="false" />
                </Button>
              )}
              <Button
                className="wallet-overview-action"
                variant="ghost"
                size="sm"
                icon
                aria-label={copyStatus === 'copied' ? 'Copied wallet address' : copyStatus === 'failed' ? 'Copy wallet address failed' : 'Copy wallet address'}
                title={copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy address'}
                disabled={!displayAddress}
                onClick={handleCopyAddress}
              >
                <FiCopy aria-hidden="true" focusable="false" />
              </Button>
              {displayAddress && (
                <ButtonLink
                  className="wallet-overview-action"
                  variant="ghost"
                  size="sm"
                  icon
                  aria-label={`Open wallet on ${activeChainLabel}`}
                  title={activeChainLabel}
                  href={explorerAddressUrl(chainId, displayAddress)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FiExternalLink aria-hidden="true" focusable="false" />
                </ButtonLink>
              )}
            </>
          )}
          {!isConnected && !hasConnectors && (
            <span className="wallet-overview-actions__empty">No connectors</span>
          )}
        </div>
      </section>
    </section>
  )

  return (
    <div ref={rootRef} className={widgetClassName}>
      {isOpen && placement === 'inline' && overviewPanel}
      <button
        className="wallet-overview__trigger"
        type="button"
        aria-label={collapsed ? 'Open wallet overview' : undefined}
        aria-haspopup={placement === 'inline' ? undefined : 'dialog'}
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        title={collapsed ? 'Wallet overview' : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="wallet-overview__trigger-icon" aria-hidden="true">
          <FiCreditCard focusable="false" />
        </span>
        <span className="wallet-overview__trigger-copy">
          <span className="wallet-overview__trigger-label">{triggerLabel(isConnected, displayAddress, isSessionLoading)}</span>
        </span>
      </button>

      {isOpen && placement !== 'inline' && (
        <Scrim className={`wallet-overview-scrim wallet-overview-scrim--${placement}`} onClick={closeOverlay}>
          {overviewPanel}
        </Scrim>
      )}
    </div>
  )
}

function WalletValueDisplay({ value }: { value: WalletValueState }) {
  if (value.status !== 'ready') {
    return <strong className="wallet-overview-balance__value">--</strong>
  }

  return (
    <strong className="wallet-overview-balance__value">
      ${value.dollars}.<span className="wallet-overview-balance__cents">{value.cents}</span>
    </strong>
  )
}
