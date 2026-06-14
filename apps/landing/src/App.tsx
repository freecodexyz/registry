import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { ProtocolSection } from './components/ProtocolSection'
import './App.css'

function App() {
  return (
    <main className="landing">
      <Navbar />
      <Hero />
      <ProtocolSection />
    </main>
  )
}

export default App
