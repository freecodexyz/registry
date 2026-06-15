import { useRef } from 'react'
import { FinalCtaSection } from './components/FinalCtaSection'
import { FooterSection } from './components/FooterSection'
import { Hero } from './components/Hero'
import { MessagingSection } from './components/MessagingSection'
import { Navbar } from './components/Navbar'
import { ProtocolSection } from './components/ProtocolSection'
import { useLandingScrollAnimation } from './useLandingScrollAnimation'
import './App.css'

function App() {
  const landingRef = useRef<HTMLElement | null>(null)

  useLandingScrollAnimation(landingRef)

  return (
    <main ref={landingRef} className="landing">
      <Navbar />
      <Hero />
      <ProtocolSection />
      <MessagingSection />
      <FinalCtaSection />
      <FooterSection />
    </main>
  )
}

export default App
