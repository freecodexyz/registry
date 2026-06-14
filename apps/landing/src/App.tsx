import { ButtonLink } from '@freecodexyz/ui'
import logoUrl from '../../web/src/assets/fcf-logo.svg'
import { Hero } from './components/Hero'
import './App.css'

const appUrl = import.meta.env.VITE_APP_URL ?? 'https://app.freecodefund.xyz'

function App() {
  return (
    <main className="landing" data-accent="emerald">
      <header className="landing-nav" aria-label="Site header">
        <a className="landing-brand" href="/" aria-label="FreeCodeFund home">
          <img className="landing-brand__logo" src={logoUrl} alt="" />
          <span>FreeCodeFund</span>
        </a>
        <ButtonLink variant="ghost" size="sm" href={appUrl}>Open app</ButtonLink>
      </header>

      <Hero />
    </main>
  )
}

export default App
