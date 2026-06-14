import { ButtonLink } from '@freecodexyz/ui'
import { TargetExternalIcon } from './TargetExternalIcon'
import { appUrl, dexscreenerUrl, docsUrl, logoUrl } from './navbarLinks'
import './DesktopNavbar.css'

export function DesktopNavbar() {
  return (
    <header className="desktop-navbar" aria-label="Site header">
      <a className="desktop-navbar__brand" href="/" aria-label="FreeCodeFund home">
        <img className="desktop-navbar__logo" src={logoUrl} alt="" />
      </a>

      <nav className="desktop-navbar__links" aria-label="Primary navigation">
        <div className="desktop-navbar__secondary-links">
          <ButtonLink className="desktop-navbar__secondary-button" variant="ghost" size="sm" href={dexscreenerUrl} target="_blank" rel="noreferrer">
            Dex
            <TargetExternalIcon className="desktop-navbar__target-external" />
          </ButtonLink>
          <ButtonLink className="desktop-navbar__secondary-button" variant="ghost" size="sm" href={docsUrl}>
            Docs
            <TargetExternalIcon className="desktop-navbar__target-external" />
          </ButtonLink>
        </div>
        <ButtonLink size="sm" href={appUrl}>Launch App</ButtonLink>
      </nav>
    </header>
  )
}
