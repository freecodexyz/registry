import { GateAccessButton } from './GateAccessButton'
import { PointCloud } from './PointCloud'

export function GateView() {
  return (
    <main className="gate-view" data-accent="emerald">
      <section className="gate-card" aria-labelledby="gate-title">
        <PointCloud className="gate-point-cloud" shape="sphere" />
        <GateAccessButton />
      </section>
    </main>
  )
}
