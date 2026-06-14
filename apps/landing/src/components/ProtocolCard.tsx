import { useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import './ProtocolCard.css'

function hash(x: number, y: number, z: number) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1013904223)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function noise3d(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = smoothstep(xf)
  const v = smoothstep(yf)
  const w = smoothstep(zf)

  const c000 = hash(xi, yi, zi)
  const c100 = hash(xi + 1, yi, zi)
  const c010 = hash(xi, yi + 1, zi)
  const c110 = hash(xi + 1, yi + 1, zi)
  const c001 = hash(xi, yi, zi + 1)
  const c101 = hash(xi + 1, yi, zi + 1)
  const c011 = hash(xi, yi + 1, zi + 1)
  const c111 = hash(xi + 1, yi + 1, zi + 1)

  const x00 = c000 * (1 - u) + c100 * u
  const x10 = c010 * (1 - u) + c110 * u
  const x01 = c001 * (1 - u) + c101 * u
  const x11 = c011 * (1 - u) + c111 * u
  const y0 = x00 * (1 - v) + x10 * v
  const y1 = x01 * (1 - v) + x11 * v
  return y0 * (1 - w) + y1 * w
}

function fbm(x: number, y: number, z: number) {
  return noise3d(x, y, z) * 0.65 + noise3d(x * 2.1, y * 2.1, z * 2.1) * 0.35
}

type DotMatrixProps = {
  seed: number;
  color: string;
}

function DotMatrix({ seed, color }: DotMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef({ x: 0, y: 0, active: false })

  useEffect(() => {
    const element = canvasRef.current
    if (!element) return
    const canvas: HTMLCanvasElement = element
    const maybeContext = canvas.getContext('2d')
    if (!maybeContext) return
    const context: CanvasRenderingContext2D = maybeContext

    let width = 0
    let height = 0
    let raf = 0
    const dpr = window.devicePixelRatio || 1
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    const cell = 5
    const seedOffset = seed * 137.5
    const seedInt = seed | 0
    const hoverRadius = 110
    const hoverRadiusSq = hoverRadius * hoverRadius
    let hoverStrength = 0

    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw(now: number) {
      const time = reducedMotion ? 0 : (now - start) / 1000
      context.clearRect(0, 0, width, height)

      const target = mouseRef.current.active ? 1 : 0
      hoverStrength += (target - hoverStrength) * 0.12

      const { x: mouseX, y: mouseY } = mouseRef.current
      const cols = Math.ceil(width / cell)
      const rows = Math.ceil(height / cell)

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const n = fbm(col * 0.07 + seedOffset, row * 0.07 + seedOffset, time * 0.18)
          let brightness = (n - 0.42) * 2.6
          if (brightness < 0) brightness = 0

          if (hoverStrength > 0.01) {
            const px = col * cell + cell / 2
            const py = row * cell + cell / 2
            const dx = px - mouseX
            const dy = py - mouseY
            const distanceSq = dx * dx + dy * dy
            if (distanceSq < hoverRadiusSq) {
              const falloff = 1 - distanceSq / hoverRadiusSq
              brightness += falloff * falloff * hoverStrength * 0.9
            }
          }

          if (brightness < 0.04) continue
          if (brightness > 1) brightness = 1

          let alpha = 0.3 + brightness * 0.7
          const jitter = hash(col + 1, row + 1, seedInt)
          if (jitter < 0.34) {
            alpha *= 0.55 + 0.45 * (Math.sin(time * 4 + jitter * 30) * 0.5 + 0.5)
          }

          context.fillStyle = `rgba(${color},${alpha.toFixed(3)})`
          context.fillRect(col * cell, row * cell, cell - 1, cell - 1)
        }
      }

      raf = window.requestAnimationFrame(draw)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()
    raf = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
    }
  }, [color, seed])

  function handleMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
    }
  }

  function handleLeave() {
    mouseRef.current.active = false
  }

  return (
    <canvas
      ref={canvasRef}
      className="protocol-card__matrix"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-hidden="true"
    />
  )
}

type ProtocolCardStyle = CSSProperties & {
  '--protocol-card-rgb': string;
}

type ProtocolCardProps = {
  icon: ReactNode;
  label: string;
  color?: string;
  seed?: number;
  className?: string;
}

export function ProtocolCard({ icon, label, color = '124, 224, 0', seed = 1, className }: ProtocolCardProps) {
  const style: ProtocolCardStyle = { '--protocol-card-rgb': color }
  const cardClassName = className ? `protocol-card ${className}` : 'protocol-card'

  return (
    <article className={cardClassName} style={style}>
      <div className="protocol-card__inner">
        <DotMatrix seed={seed} color={color} />
        <div className="protocol-card__shade" />
        <div className="protocol-card__icon">{icon}</div>
        <h3 className="protocol-card__label">{label}</h3>
      </div>
    </article>
  )
}
