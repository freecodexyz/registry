import { useState } from 'react'
import { Button, ButtonLink } from '@freecodexyz/ui'
import { TargetExternalIcon } from './TargetExternalIcon'
import { appUrl, dexscreenerUrl, docsUrl, logoUrl } from './navbarLinks'
import './MobileNavbar.css'

export function MobileNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header
      className="mobile-navbar"
      aria-label="Site header"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsMenuOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsMenuOpen(false)
      }}
    >
      <a className="mobile-navbar__brand" href="/" aria-label="FreeCodeFund home">
        <img className="mobile-navbar__logo" src={logoUrl} alt="" />
      </a>

      <Button
        className="mobile-navbar__toggle"
        variant="ghost"
        size="sm"
        icon
        aria-label="Open navigation menu"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls="mobile-navbar-menu"
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 5h14v1.5H3V5Zm0 4.25h14v1.5H3v-1.5ZM3 13.5h14V15H3v-1.5Z" />
        </svg>
      </Button>

      {isMenuOpen && (
        <nav id="mobile-navbar-menu" className="mobile-navbar__menu" aria-label="Primary navigation" role="menu">
          <ButtonLink className="mobile-navbar__menu-link" variant="ghost" href={dexscreenerUrl} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setIsMenuOpen(false)}>
            Dex
            <TargetExternalIcon className="mobile-navbar__target-external" />
          </ButtonLink>
          <ButtonLink className="mobile-navbar__menu-link" variant="ghost" href={docsUrl} role="menuitem" onClick={() => setIsMenuOpen(false)}>
            Docs
            <TargetExternalIcon className="mobile-navbar__target-external" />
          </ButtonLink>
          <ButtonLink className="mobile-navbar__menu-link" href={appUrl} role="menuitem" onClick={() => setIsMenuOpen(false)}>
            Launch App
          </ButtonLink>
        </nav>
      )}
    </header>
  )
}
