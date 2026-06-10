import { useEffect, useState } from 'react'
import { ConnectButton } from './ConnectButton'
import logoUrl from './assets/fcf-logo.svg'

const MOBILE_NAV_QUERY = '(max-width: 720px)'

function isMobileNav() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_NAV_QUERY).matches
}

export function TopNavbar() {
  const [isMobile, setIsMobile] = useState(isMobileNav)
  const navClassName = isMobile ? 'top-navbar top-navbar--mobile' : 'top-navbar top-navbar--desktop'
  const innerClassName = isMobile ? 'top-navbar__mobile' : 'top-navbar__desktop'

  useEffect(() => {
    const navQuery = window.matchMedia(MOBILE_NAV_QUERY)

    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches)
    }

    navQuery.addEventListener('change', handleChange)
    return () => navQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <header className={navClassName} data-accent="emerald">
      <nav className={innerClassName} aria-label={isMobile ? 'Mobile navigation' : 'Main navigation'}>
        <a className="top-navbar__brand" href="/" aria-label="FreeCode Registry">
          <img className="top-navbar__logo" src={logoUrl} alt="" />
        </a>
        <ConnectButton />
      </nav>
    </header>
  )
}
