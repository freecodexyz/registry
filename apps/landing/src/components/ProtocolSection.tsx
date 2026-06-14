import type { ReactNode } from 'react'
import { ProtocolCard } from './ProtocolCard'
import './ProtocolSection.css'

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function KeyIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="7.5" cy="14.5" r="3.5" />
      <path d="m10 12 8-8" />
      <path d="m15 5 3 3" />
      <path d="m13 7 2 2" />
    </svg>
  )
}

function CommandLineIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="m4 7 5 5-5 5" />
      <path d="M11 17h9" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-5" />
    </svg>
  )
}

function ChainIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15" />
    </svg>
  )
}

type ProtocolCardConfig = {
  label: string;
  icon: ReactNode;
  color: string;
}

const PROTOCOL_CARDS: ProtocolCardConfig[] = [
  { label: 'RIK', icon: <KeyIcon />, color: '124, 224, 0' },
  { label: 'CLI', icon: <CommandLineIcon />, color: '88, 226, 255' },
  { label: 'Secure', icon: <ShieldIcon />, color: '74, 222, 128' },
  { label: 'Decentralized', icon: <ChainIcon />, color: '190, 255, 112' },
]

export function ProtocolSection() {
  return (
    <section className="protocol" aria-labelledby="protocol-heading">
      <div className="protocol__header">
        <h2 className="protocol__heading" id="protocol-heading">The FCF Protocol</h2>
      </div>

      <div className="protocol__cards">
        {PROTOCOL_CARDS.map((card, index) => (
          <ProtocolCard key={card.label} {...card} seed={index + 1} />
        ))}
      </div>
    </section>
  )
}
