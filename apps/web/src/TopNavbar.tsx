import { useEffect, useState } from 'react'
import { Notice } from '@freecodexyz/ui'
import { ConnectButton } from './ConnectButton'
import { ThemeSwitch } from './ThemeSwitch'
import logoUrl from './assets/fcf-logo.svg'

const MOBILE_NAV_QUERY = '(max-width: 720px)'

function isMobileNav() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_NAV_QUERY).matches
}

type TopNavbarProps = {
  showPageLinks?: boolean
}

export function TopNavbar({ showPageLinks = true }: TopNavbarProps) {
  const [isMobile, setIsMobile] = useState(isMobileNav)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navClassName = isMobile ? 'top-navbar top-navbar--mobile' : 'top-navbar top-navbar--desktop'
  const innerClassName = isMobile ? 'top-navbar__mobile' : 'top-navbar__desktop'

  useEffect(() => {
    const navQuery = window.matchMedia(MOBILE_NAV_QUERY)

    function handleChange(event: MediaQueryListEvent) {
      setIsMenuOpen(false)
      setIsMobile(event.matches)
    }

    navQuery.addEventListener('change', handleChange)
    return () => navQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <header className={navClassName} data-accent="emerald">
      <Notice className="release-banner" role="status">
        <span className="release-banner__copy">Registry is still in alpha and currently live on Base Sepolia Testnet.</span>
        <a className="release-banner__link" href="https://docs.freecodefund.xyz/guide/troubleshooting#need-more-help">Report an issue or bug</a>
      </Notice>
      <nav className={innerClassName} aria-label={isMobile ? 'Mobile navigation' : 'Main navigation'}>
        {isMobile && (
          <div
            className="top-navbar__mobile-menu"
            onBlur={(event) => {
              const nextTarget = event.relatedTarget
              if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsMenuOpen(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsMenuOpen(false)
            }}
          >
            <button className="top-navbar__menu-button" type="button" aria-label="Open navigation menu" aria-haspopup="menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen((open) => !open)}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 5h14v1.5H3V5Zm0 4.25h14v1.5H3v-1.5ZM3 13.5h14V15H3v-1.5Z" />
              </svg>
            </button>
            {isMenuOpen && (
              <div className="top-navbar__mobile-menu-panel" role="menu">
                {showPageLinks && (
                  <div className="top-navbar__page-links top-navbar__page-links--mobile" aria-label="Available pages">
                    <a className="top-navbar__page-link" href="/" aria-current="page" role="menuitem">Registry</a>
                    <span className="top-navbar__page-link top-navbar__page-link--disabled" aria-disabled="true" role="menuitem">Marketplace</span>
                  </div>
                )}
                <div className="top-navbar__mobile-actions">
                  <ConnectButton />
                  <ThemeSwitch />
                </div>
              </div>
            )}
          </div>
        )}
        <a className="top-navbar__brand" href="/" aria-label="FreeCode Registry">
          <img className="top-navbar__logo" src={logoUrl} alt="" />
        </a>
        {showPageLinks && !isMobile && (
          <div className="top-navbar__page-links" aria-label="Available pages">
            <a className="top-navbar__page-link" href="/" aria-current="page">Registry</a>
            <span className="top-navbar__page-link top-navbar__page-link--disabled" aria-disabled="true">Marketplace</span>
          </div>
        )}
        {!isMobile && (
          <div className="top-navbar__actions">
            <ConnectButton />
            <ThemeSwitch />
          </div>
        )}
      </nav>
    </header>
  )
}
