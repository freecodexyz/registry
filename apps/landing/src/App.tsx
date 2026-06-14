import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import './App.css'

function App() {
  return (
    <main className="landing" data-accent="emerald">
      <Navbar />
      <Hero />
    </main>
  )
}

export default App
