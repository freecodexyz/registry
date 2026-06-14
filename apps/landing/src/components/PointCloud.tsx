import { useEffect, useRef } from 'react'

export type PointCloudShape = 'torus' | 'sphere' | 'knot' | 'gem' | 'helix' | 'mobius' | 'terrain'

type RotationConfig = {
  axBase: number;
  axRate: number;
  ayBase: number;
  ayRate: number;
}

const SHAPES: PointCloudShape[] = ['torus', 'sphere', 'knot', 'gem', 'helix', 'mobius', 'terrain']
const FALLBACK_ACCENT = [124, 224, 0]

function buildPoints(shape: PointCloudShape, count: number) {
  const points = new Float32Array(count * 4)

  function set(index: number, x: number, y: number, z: number) {
    points[index * 4] = x
    points[index * 4 + 1] = y
    points[index * 4 + 2] = z
    points[index * 4 + 3] = Math.random()
  }

  if (shape === 'sphere') {
    const radius = 1.15
    for (let index = 0; index < count; index += 1) {
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const ringRadius = Math.sqrt(1 - u * u)
      set(index, radius * ringRadius * Math.cos(theta), radius * u, radius * ringRadius * Math.sin(theta))
    }
  } else if (shape === 'mobius') {
    for (let index = 0; index < count; index += 1) {
      const u = Math.random() * Math.PI * 2
      const v = (Math.random() - 0.5) * 0.7
      const half = u / 2
      const radius = 1 + v * Math.cos(half)
      set(index, radius * Math.cos(u), v * Math.sin(half) * 1.05, radius * Math.sin(u))
    }
  } else if (shape === 'knot') {
    const tubeRadius = 0.28
    const scale = 0.42
    for (let index = 0; index < count; index += 1) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 2
      const cx = Math.sin(theta) + 2 * Math.sin(2 * theta)
      const cy = Math.cos(theta) - 2 * Math.cos(2 * theta)
      const cz = -Math.sin(3 * theta)
      let tx = Math.cos(theta) + 4 * Math.cos(2 * theta)
      let ty = -Math.sin(theta) + 4 * Math.sin(2 * theta)
      let tz = -3 * Math.cos(3 * theta)
      const tangentLength = Math.hypot(tx, ty, tz) || 1
      tx /= tangentLength
      ty /= tangentLength
      tz /= tangentLength
      const rx = 0
      let ry = 0
      let rz = 1
      if (Math.abs(tz) > 0.95) {
        ry = 1
        rz = 0
      }
      const dot = rx * tx + ry * ty + rz * tz
      let nx = rx - dot * tx
      let ny = ry - dot * ty
      let nz = rz - dot * tz
      const normalLength = Math.hypot(nx, ny, nz) || 1
      nx /= normalLength
      ny /= normalLength
      nz /= normalLength
      const bx = ty * nz - tz * ny
      const by = tz * nx - tx * nz
      const bz = tx * ny - ty * nx
      const cosPhi = Math.cos(phi)
      const sinPhi = Math.sin(phi)
      set(
        index,
        (cx + tubeRadius * (cosPhi * nx + sinPhi * bx)) * scale,
        (cy + tubeRadius * (cosPhi * ny + sinPhi * by)) * scale,
        (cz + tubeRadius * (cosPhi * nz + sinPhi * bz)) * scale,
      )
    }
  } else if (shape === 'gem') {
    const phi = (1 + Math.sqrt(5)) / 2
    const vertices: [number, number, number][] = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
    const faces: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
    const scale = 0.62
    for (let index = 0; index < count; index += 1) {
      const face = faces[Math.floor(Math.random() * faces.length)]
      let a = Math.random()
      let b = Math.random()
      if (a + b > 1) {
        a = 1 - a
        b = 1 - b
      }
      const c = 1 - a - b
      const v1 = vertices[face[0]]
      const v2 = vertices[face[1]]
      const v3 = vertices[face[2]]
      set(index, (a * v1[0] + b * v2[0] + c * v3[0]) * scale, (a * v1[1] + b * v2[1] + c * v3[1]) * scale, (a * v1[2] + b * v2[2] + c * v3[2]) * scale)
    }
  } else if (shape === 'helix') {
    const radius = 0.58
    const turns = 3.4
    for (let index = 0; index < count; index += 1) {
      if (Math.random() < 0.12) {
        const step = Math.floor(Math.random() * 14)
        const t = (step / 13) * 2 - 1
        const angle = t * turns * Math.PI
        const lerp = Math.random() * 2 - 1
        set(index, radius * Math.cos(angle) * lerp, t * 1.45, radius * Math.sin(angle) * lerp)
      } else {
        const strand = index % 2
        const t = Math.random() * 2 - 1
        const angle = t * turns * Math.PI + strand * Math.PI
        set(index, radius * Math.cos(angle), t * 1.45, radius * Math.sin(angle))
      }
    }
  } else if (shape === 'terrain') {
    for (let index = 0; index < count; index += 1) {
      set(index, (Math.random() * 2 - 1) * 1.55, 0, (Math.random() * 2 - 1) * 1.55)
    }
  } else {
    const ringRadius = 1.05
    const tubeRadius = 0.46
    for (let index = 0; index < count; index += 1) {
      const u = Math.random() * Math.PI * 2
      const v = Math.random() * Math.PI * 2
      const cosU = Math.cos(u)
      const sinU = Math.sin(u)
      const cosV = Math.cos(v)
      const sinV = Math.sin(v)
      set(index, (ringRadius + tubeRadius * cosV) * cosU, tubeRadius * sinV, (ringRadius + tubeRadius * cosV) * sinU)
    }
  }

  return points
}

function rotationFor(shape: PointCloudShape): RotationConfig {
  if (shape === 'terrain') return { axBase: 1.05, axRate: 0, ayBase: 0.3, ayRate: 0.34 }
  if (shape === 'helix') return { axBase: 0.18, axRate: 0, ayBase: 0.9, ayRate: 0.42 }
  return { axBase: 0.4, axRate: 0.22, ayBase: 0.9, ayRate: 0.32 }
}

function resolveAccent(canvas: HTMLCanvasElement, color: string | undefined) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return FALLBACK_ACCENT

  try {
    const resolvedColor = color || getComputedStyle(canvas).getPropertyValue('--accent').trim() || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    if (!resolvedColor) return FALLBACK_ACCENT
    context.fillStyle = 'rgb(1, 2, 3)'
    context.fillStyle = resolvedColor
    context.clearRect(0, 0, 1, 1)
    context.fillRect(0, 0, 1, 1)
    const data = context.getImageData(0, 0, 1, 1).data
    if (!(data[0] === 1 && data[1] === 2 && data[2] === 3) && data[3] > 0) return [data[0], data[1], data[2]]
  } catch {
    return FALLBACK_ACCENT
  }

  return FALLBACK_ACCENT
}

type PointCloudProps = {
  shape?: PointCloudShape;
  density?: number;
  color?: string;
  className?: string;
}

export function PointCloud({ shape = 'mobius', density = 1, color, className }: PointCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) return
    const canvas: HTMLCanvasElement = canvasElement
    const maybeContext = canvas.getContext('2d')
    if (!maybeContext) return
    const context: CanvasRenderingContext2D = maybeContext

    const safeShape = SHAPES.includes(shape) ? shape : 'mobius'
    const safeDensity = Math.max(0.3, Math.min(2, density))
    const pointCount = Math.round(5200 * safeDensity)
    const points = buildPoints(safeShape, pointCount)
    const rotation = rotationFor(safeShape)
    const allowDissolve = safeShape !== 'terrain'
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    let accent = resolveAccent(probe, color)
    let width = 0
    let height = 0
    let raf = 0
    let start = performance.now()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      const dpr = window.devicePixelRatio || 1
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw(now: number) {
      raf = 0
      const time = (now - start) / 1000
      context.clearRect(0, 0, width, height)
      if (width < 4 || height < 4) {
        raf = window.requestAnimationFrame(draw)
        return
      }

      const centerX = width / 2
      const centerY = height / 2
      const scale = Math.min(width, height) * 0.4
      const ax = reducedMotion ? rotation.axBase : time * rotation.axRate + rotation.axBase
      const ay = reducedMotion ? rotation.ayBase : time * rotation.ayRate + rotation.ayBase
      const cosAx = Math.cos(ax)
      const sinAx = Math.sin(ax)
      const cosAy = Math.cos(ay)
      const sinAy = Math.sin(ay)
      const cell = 5
      const cols = Math.ceil(width / cell) + 2
      const rows = Math.ceil(height / cell) + 2
      const depthBuffer = new Float32Array(cols * rows)
      const jitterBuffer = new Float32Array(cols * rows)
      const filled = new Uint8Array(cols * rows)
      depthBuffer.fill(-Infinity)

      for (let index = 0; index < pointCount; index += 1) {
        const x = points[index * 4]
        let y = points[index * 4 + 1]
        const z = points[index * 4 + 2]
        const jitter = points[index * 4 + 3]

        if (safeShape === 'terrain') {
          y = Math.sin(x * 2.4 + time * 1.5) * 0.22 + Math.cos(z * 1.9 + time * 1.1) * 0.18 + Math.sin((x + z) * 1.3 - time * 0.9) * 0.1
        }

        const x1 = x * cosAy - z * sinAy
        const z1 = x * sinAy + z * cosAy
        const y2 = y * cosAx - z1 * sinAx
        const z2 = y * sinAx + z1 * cosAx
        let dissolveX = 0
        let dissolveY = 0
        const upMix = -y2
        if (allowDissolve && !reducedMotion && upMix > 0.55) {
          const factor = (upMix - 0.55) * 1.6
          const phase = time * 1.4 + jitter * 12
          const noise = Math.sin(phase) * 0.5 + Math.sin(phase * 2.3) * 0.5
          if (jitter < 0.34) {
            dissolveX = noise * factor * 38 * (jitter - 0.17)
            dissolveY = -factor * (12 + jitter * 90)
          }
        }

        const screenX = centerX + x1 * scale + dissolveX
        const screenY = centerY + y2 * scale + dissolveY
        if (screenX < 0 || screenY < 0 || screenX >= width || screenY >= height) continue
        const bufferIndex = Math.floor(screenY / cell) * cols + Math.floor(screenX / cell)
        if (z2 > depthBuffer[bufferIndex]) {
          depthBuffer[bufferIndex] = z2
          jitterBuffer[bufferIndex] = jitter
          filled[bufferIndex] = 1
        }
      }

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const index = row * cols + col
          if (!filled[index]) continue
          const depth = depthBuffer[index]
          let alpha = 0.3 + ((depth + 1.5) / 3) * 0.7
          if (alpha > 1) alpha = 1
          const jitter = jitterBuffer[index]
          if (jitter < 0.34) alpha *= 0.55 + 0.45 * (Math.sin(time * 4 + jitter * 30) * 0.5 + 0.5)
          context.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${alpha.toFixed(3)})`
          context.fillRect(col * cell, row * cell, cell - 1, cell - 1)
        }
      }

      raf = window.requestAnimationFrame(draw)
    }

    function retint() {
      accent = resolveAccent(probe, color)
    }

    const resizeObserver = new ResizeObserver(resize)
    const mutationObserver = new MutationObserver(retint)
    resizeObserver.observe(canvas)
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'data-accent'] })
    resize()
    start = performance.now()
    draw(start)

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [color, density, shape])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
