import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { FiCopy, FiCreditCard, FiExternalLink, FiPower, FiShield } from 'react-icons/fi'
import { useAccount, useChainId, useConnect } from 'wagmi'
import { Button, Scrim } from '@freecodexyz/ui'
import { chainLabel, explorerAddressUrl } from '../../shared/explorers'
import { useAuthSession } from './useAuthSession'
import { useWalletDollarValue, type WalletValueState } from './walletValueApi'

type WalletOverviewWidgetProps = {
  collapsed?: boolean;
}

type WalletActionCardProps = {
  title: string;
  detail: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function triggerLabel(isConnected: boolean, address: string | undefined, isSessionLoading: boolean) {
  if (address && isConnected) return shortAddress(address)
  if (isSessionLoading) return 'Checking wallet'
  return 'Connect wallet'
}

export function WalletOverviewWidget({ collapsed = false }: WalletOverviewWidgetProps) {
  const titleId = useId()
  const dialogId = useId()
  const accountMenuId = useId()
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
  const signInDetail = isSigningIn
    ? 'Open wallet'
    : isPreparingSignIn
      ? 'Preparing nonce'
      : isSignInReady
        ? 'Sign SIWE nonce'
        : 'Nonce unavailable'

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

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

  return (
    <div className={`wallet-overview ${collapsed ? 'wallet-overview--collapsed' : ''}`}>
      <button
        className="wallet-overview__trigger"
        type="button"
        aria-label={collapsed ? 'Open wallet overview' : undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? dialogId : undefined}
        title={collapsed ? 'Wallet overview' : undefined}
        onClick={() => setIsOpen(true)}
      >
        <span className="wallet-overview__trigger-icon" aria-hidden="true">
          <FiCreditCard focusable="false" />
        </span>
        <span className="wallet-overview__trigger-copy">
          <span className="wallet-overview__trigger-label">{triggerLabel(isConnected, displayAddress, isSessionLoading)}</span>
        </span>
      </button>

      {isOpen && (
        <Scrim className="wallet-overview-scrim" onClick={closeOverlay}>
          <section
            id={dialogId}
            className="wallet-overview-dialog"
            role="dialog"
            aria-modal="true"
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
              <div className="wallet-overview-actions__grid">
                {!isConnected ? (
                  connectors.map((connector) => (
                    <WalletActionCard
                      key={connector.id}
                      title={connector.name}
                      detail="Connect wallet"
                      icon={<FiCreditCard aria-hidden="true" focusable="false" />}
                      onClick={() => handleConnect(connector)}
                    />
                  ))
                ) : (
                  <>
                    {!isSignedIn && (
                      <WalletActionCard
                        title="Sign nonce"
                        detail={signInDetail}
                        icon={<FiShield aria-hidden="true" focusable="false" />}
                        disabled={!canSignIn}
                        onClick={handleSignIn}
                      />
                    )}
                    <WalletActionCard
                      title="Copy address"
                      detail={copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Wallet address'}
                      icon={<FiCopy aria-hidden="true" focusable="false" />}
                      disabled={!displayAddress}
                      onClick={handleCopyAddress}
                    />
                    {displayAddress && (
                      <WalletActionCard
                        title="Explorer"
                        detail={activeChainLabel}
                        icon={<FiExternalLink aria-hidden="true" focusable="false" />}
                        href={explorerAddressUrl(chainId, displayAddress)}
                      />
                    )}
                  </>
                )}
                {!isConnected && !hasConnectors && (
                  <span className="wallet-overview-actions__empty">No wallet connectors</span>
                )}
              </div>
            </section>
          </section>
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

function WalletActionCard({ title, detail, icon, disabled = false, onClick, href }: WalletActionCardProps) {
  const className = 'wallet-action-card'
  const content = (
    <>
      <span className="wallet-action-card__icon">{icon}</span>
      <span className="wallet-action-card__copy">
        <span className="wallet-action-card__title">{title}</span>
        <span className="wallet-action-card__detail">{detail}</span>
      </span>
    </>
  )

  if (href) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    )
  }

  return (
    <button className={className} type="button" disabled={disabled} onClick={onClick}>
      {content}
    </button>
  )
}
