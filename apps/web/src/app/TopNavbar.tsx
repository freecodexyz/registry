import { useEffect, useId, useState } from 'react'
import { FiBarChart2, FiChevronLeft, FiChevronRight, FiDatabase, FiMenu, FiRepeat, FiUser } from 'react-icons/fi'
import { Link, NavLink } from 'react-router'
import { Notice, Scrim } from '@freecodexyz/ui'
import { ConnectButton } from '../features/auth/ConnectButton'
import { ThemeSwitch } from '../shared/theme/ThemeSwitch'
import logoUrl from '../assets/fcf-logo.svg'

const MOBILE_NAV_QUERY = '(max-width: 720px)'
const MARKETPLACE_NAV_ENABLED = false
const NAV_ITEMS = [
  { to: '/registry', label: 'Registry', Icon: FiDatabase, enabled: true },
  { to: '/trade', label: 'Trade', Icon: FiRepeat, enabled: true },
  { to: '/marketplace', label: 'Marketplace', Icon: FiBarChart2, enabled: MARKETPLACE_NAV_ENABLED },
] as const

function isMobileNav() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_NAV_QUERY).matches
}

type TopNavbarProps = {
  registryAccess: 'locked' | 'unlocked';
}

export function TopNavbar({ registryAccess }: TopNavbarProps) {
  const mobileMenuId = useId()
  const mobileMenuTitleId = useId()
  const desktopWalletId = useId()
  const [isMobile, setIsMobile] = useState(isMobileNav)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDesktopWalletOpen, setIsDesktopWalletOpen] = useState(false)
  const showPageLinks = registryAccess === 'unlocked'
  const useOriginalTopbar = isMobile || registryAccess === 'locked'
  const navClassName = useOriginalTopbar
    ? `top-navbar ${isMobile ? 'top-navbar--mobile' : 'top-navbar--desktop'}`
    : `top-navbar top-navbar--sidebar ${isSidebarCollapsed ? 'top-navbar--collapsed' : 'top-navbar--expanded'}`
  const innerClassName = useOriginalTopbar
    ? `${isMobile ? 'top-navbar__mobile' : 'top-navbar__desktop'}`
    : `top-navbar__sidebar ${isSidebarCollapsed ? 'top-navbar__sidebar--collapsed' : 'top-navbar__sidebar--expanded'}`

  useEffect(() => {
    const navQuery = window.matchMedia(MOBILE_NAV_QUERY)

    function handleChange(event: MediaQueryListEvent) {
      setIsMenuOpen(false)
      setIsDesktopWalletOpen(false)
      setIsMobile(event.matches)
    }

    navQuery.addEventListener('change', handleChange)
    return () => navQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!isMobile || !isMenuOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMenuOpen, isMobile])

  useEffect(() => {
    if (useOriginalTopbar) return

    const root = document.getElementById('root')
    const releaseBanner = document.querySelector<HTMLElement>('.top-navbar--sidebar .release-banner')
    if (!root || !releaseBanner) return
    const rootElement = root
    const releaseBannerElement = releaseBanner

    function syncReleaseBannerHeight() {
      rootElement.style.setProperty('--release-banner-height', `${Math.ceil(releaseBannerElement.getBoundingClientRect().height)}px`)
    }

    syncReleaseBannerHeight()
    const resizeObserver = new ResizeObserver(syncReleaseBannerHeight)
    resizeObserver.observe(releaseBannerElement)
    window.addEventListener('resize', syncReleaseBannerHeight)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncReleaseBannerHeight)
      rootElement.style.removeProperty('--release-banner-height')
    }
  }, [useOriginalTopbar])

  function toggleSidebar() {
    setIsDesktopWalletOpen(false)
    setIsSidebarCollapsed((collapsed) => !collapsed)
  }

  return (
    <>
      <header className={navClassName} data-accent="emerald">
        <Notice className="release-banner" role="status">
          <span className="release-banner__copy">Registry is still in alpha and currently live on Base Sepolia Testnet.</span>
          <a className="release-banner__link" href="https://docs.freecodefund.xyz/guide/troubleshooting#need-more-help">Report an issue or bug</a>
        </Notice>
        <nav className={innerClassName} aria-label={isMobile ? 'Mobile navigation' : 'Main navigation'}>
          {isMobile && (
            <div className="top-navbar__mobile-menu">
              <button
                className="top-navbar__menu-button"
                type="button"
                aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-haspopup="dialog"
                aria-expanded={isMenuOpen}
                aria-controls={isMenuOpen ? mobileMenuId : undefined}
                onClick={() => setIsMenuOpen((open) => !open)}
              >
                <FiMenu aria-hidden="true" focusable="false" />
              </button>
            </div>
          )}
          {useOriginalTopbar ? (
            <>
              <Link className="top-navbar__brand" to="/registry" aria-label="FreeCode Registry">
                <img className="top-navbar__logo" src={logoUrl} alt="" />
              </Link>
              {showPageLinks && !isMobile && (
                <div className="top-navbar__page-links" aria-label="Available pages">
                  <NavLink className="top-navbar__page-link" to="/registry">Registry</NavLink>
                  <NavLink className="top-navbar__page-link" to="/trade">Trade</NavLink>
                  {MARKETPLACE_NAV_ENABLED && <NavLink className="top-navbar__page-link" to="/marketplace">Marketplace</NavLink>}
                </div>
              )}
              {!isMobile && (
                <div className="top-navbar__actions">
                  <ConnectButton />
                  <ThemeSwitch />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="top-navbar__sidebar-top">
                <Link className="top-navbar__brand" to="/registry" aria-label="FreeCode Registry">
                  <img className="top-navbar__logo" src={logoUrl} alt="" />
                  <span className="top-navbar__brand-label">FCF</span>
                </Link>
                <button
                  className="top-navbar__icon-button top-navbar__collapse-button"
                  type="button"
                  aria-label={isSidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
                  title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                  aria-pressed={isSidebarCollapsed}
                  onClick={toggleSidebar}
                >
                  {isSidebarCollapsed ? <FiChevronRight aria-hidden="true" focusable="false" /> : <FiChevronLeft aria-hidden="true" focusable="false" />}
                </button>
              </div>
              <div className="top-navbar__page-links" aria-label="Available pages">
                {NAV_ITEMS.filter((item) => item.enabled !== false).map(({ to, label, Icon }) => (
                  <NavLink key={to} className="top-navbar__page-link" to={to} aria-label={label} title={isSidebarCollapsed ? label : undefined}>
                    <Icon className="top-navbar__page-link-icon" aria-hidden="true" focusable="false" />
                    <span className="top-navbar__page-link-label">{label}</span>
                  </NavLink>
                ))}
              </div>
              <div className="top-navbar__sidebar-bottom">
                <div className="top-navbar__actions">
                  {isSidebarCollapsed ? (
                    <div
                      className="top-navbar__wallet-menu"
                      onBlur={(event) => {
                        const nextTarget = event.relatedTarget
                        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsDesktopWalletOpen(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setIsDesktopWalletOpen(false)
                      }}
                    >
                      <button
                        className="top-navbar__icon-button"
                        type="button"
                        aria-label="Wallet"
                        aria-haspopup="dialog"
                        aria-expanded={isDesktopWalletOpen}
                        aria-controls={isDesktopWalletOpen ? desktopWalletId : undefined}
                        title="Wallet"
                        onClick={() => setIsDesktopWalletOpen((open) => !open)}
                      >
                        <FiUser aria-hidden="true" focusable="false" />
                      </button>
                      {isDesktopWalletOpen && (
                        <div id={desktopWalletId} className="top-navbar__wallet-popover" role="dialog" aria-label="Wallet actions">
                          <ConnectButton />
                        </div>
                      )}
                    </div>
                  ) : (
                    <ConnectButton />
                  )}
                  <ThemeSwitch />
                </div>
              </div>
            </>
          )}
        </nav>
      </header>
      {isMobile && isMenuOpen && (
        <Scrim className="top-navbar__mobile-menu-scrim" onClick={() => setIsMenuOpen(false)}>
          <div
            id={mobileMenuId}
            className="top-navbar__mobile-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={mobileMenuTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="top-navbar__mobile-menu-top">
              <h2 id={mobileMenuTitleId}>Menu</h2>
              <button className="top-navbar__mobile-menu-close" type="button" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation menu">×</button>
            </header>
            {showPageLinks && (
              <div className="top-navbar__page-links top-navbar__page-links--mobile" aria-label="Available pages">
                <NavLink className="top-navbar__page-link" to="/registry" onClick={() => setIsMenuOpen(false)}>Registry</NavLink>
                <NavLink className="top-navbar__page-link" to="/trade" onClick={() => setIsMenuOpen(false)}>Trade</NavLink>
                {MARKETPLACE_NAV_ENABLED && <NavLink className="top-navbar__page-link" to="/marketplace" onClick={() => setIsMenuOpen(false)}>Marketplace</NavLink>}
              </div>
            )}
            <div className="top-navbar__mobile-actions">
              <ConnectButton />
              <ThemeSwitch />
            </div>
          </div>
        </Scrim>
      )}
    </>
  )
}
