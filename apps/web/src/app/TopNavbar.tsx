import { useEffect, useState } from 'react'
import { FiMenu } from 'react-icons/fi'
import { Link, NavLink } from 'react-router'
import { Notice } from '@freecodexyz/ui'
import { ConnectButton } from '../features/auth/ConnectButton'
import { ThemeSwitch } from '../shared/theme/ThemeSwitch'
import logoUrl from '../assets/fcf-logo.svg'

const MOBILE_NAV_QUERY = '(max-width: 720px)'
const MARKETPLACE_NAV_ENABLED = false

function isMobileNav() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_NAV_QUERY).matches
}

type TopNavbarProps = {
  registryAccess: 'locked' | 'unlocked';
}

export function TopNavbar({ registryAccess }: TopNavbarProps) {
  const [isMobile, setIsMobile] = useState(isMobileNav)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const showPageLinks = registryAccess === 'unlocked'
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
              <FiMenu aria-hidden="true" focusable="false" />
            </button>
            {isMenuOpen && (
              <div className="top-navbar__mobile-menu-panel" role="menu">
                {showPageLinks && (
                  <div className="top-navbar__page-links top-navbar__page-links--mobile" aria-label="Available pages">
                    <NavLink className="top-navbar__page-link" to="/registry" role="menuitem" onClick={() => setIsMenuOpen(false)}>Registry</NavLink>
                    {MARKETPLACE_NAV_ENABLED && <NavLink className="top-navbar__page-link" to="/marketplace" role="menuitem" onClick={() => setIsMenuOpen(false)}>Marketplace</NavLink>}
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
        <Link className="top-navbar__brand" to="/registry" aria-label="FreeCode Registry">
          <img className="top-navbar__logo" src={logoUrl} alt="" />
        </Link>
        {showPageLinks && !isMobile && (
          <div className="top-navbar__page-links" aria-label="Available pages">
            <NavLink className="top-navbar__page-link" to="/registry">Registry</NavLink>
            {MARKETPLACE_NAV_ENABLED && <NavLink className="top-navbar__page-link" to="/marketplace">Marketplace</NavLink>}
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
