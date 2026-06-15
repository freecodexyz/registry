import { ButtonLink } from '@freecodexyz/ui'
import { appUrl, docsUrl } from './navbarLinks'
import './HeroText.css'

export function HeroText() {
  return (
    <div className="hero-text">
      <h1 className="hero-text__heading">The Decentralized Marketplace Of Open Source Software</h1>
      <p className="hero-text__subheading">
        Open decentralized market that turns open source code into a tokenized cashflow generating asset
      </p>
      <div className="hero-text__actions" aria-label="Hero actions">
        <ButtonLink className="hero-text__button" href={appUrl}>Enter App</ButtonLink>
        <ButtonLink className="hero-text__button" variant="ghost" href={docsUrl}>Learn</ButtonLink>
      </div>
    </div>
  )
}
