import { HeroText } from './HeroText'
import { NoiseField } from './NoiseField'
import './Hero.css'

export function Hero() {
  return (
    <section className="hero">
      <NoiseField className="hero__noise" />
      <HeroText />
    </section>
  )
}
