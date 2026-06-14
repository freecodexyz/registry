import { FinalCtaSection } from './components/FinalCtaSection'
import { FooterSection } from './components/FooterSection'
import { Hero } from './components/Hero'
import { MessagingSection } from './components/MessagingSection'
import { Navbar } from './components/Navbar'
import { ProtocolSection } from './components/ProtocolSection'
import './App.css'

function App() {
  return (
    <main className="landing">
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
