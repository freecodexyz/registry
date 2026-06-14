import { useEffect, useState } from 'react'
import { DesktopNavbar } from './DesktopNavbar'
import { MobileNavbar } from './MobileNavbar'

const MOBILE_NAV_QUERY = '(max-width: 720px)'

function isMobileNavbar() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_NAV_QUERY).matches
}

export function Navbar() {
  const [isMobile, setIsMobile] = useState(isMobileNavbar)

  useEffect(() => {
    const navQuery = window.matchMedia(MOBILE_NAV_QUERY)

    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches)
    }

    navQuery.addEventListener('change', handleChange)
    return () => navQuery.removeEventListener('change', handleChange)
  }, [])

  return isMobile ? <MobileNavbar /> : <DesktopNavbar />
}
