import { useEffect, useRef } from 'react'

const FALLBACK_ACCENT = [124, 224, 0]

function createPerlin(seed = 1337) {
  const perm = new Uint8Array(512)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) base[i] = i
  let s = seed
  for (let i = 255; i > 0; i -= 1) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    const tmp = base[i]
    base[i] = base[j]
    base[j] = tmp
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255]

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const lerp = (a: number, b: number, t: number) => a + t * (b - a)
  const grad = (h: number, x: number, y: number) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y)

  return function perlin(x: number, y: number) {
    const xi = Math.floor(x) & 255
    const yi = Math.floor(y) & 255
    const xf = x - Math.floor(x)
    const yf = y - Math.floor(y)
    const u = fade(xf)
    const v = fade(yf)
    const aa = perm[perm[xi] + yi]
    const ab = perm[perm[xi] + yi + 1]
    const ba = perm[perm[xi + 1] + yi]
    const bb = perm[perm[xi + 1] + yi + 1]
    return lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v,
    )
  }
}

function resolveAccent(canvas: HTMLCanvasElement, color: string | undefined) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return FALLBACK_ACCENT
  try {
    const resolved = color
      || getComputedStyle(canvas).getPropertyValue('--accent').trim()
      || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    if (!resolved) return FALLBACK_ACCENT
    context.fillStyle = 'rgb(1, 2, 3)'
    context.fillStyle = resolved
    context.clearRect(0, 0, 1, 1)
    context.fillRect(0, 0, 1, 1)
    const data = context.getImageData(0, 0, 1, 1).data
    if (!(data[0] === 1 && data[1] === 2 && data[2] === 3) && data[3] > 0) {
      return [data[0], data[1], data[2]]
    }
  } catch {
    return FALLBACK_ACCENT
  }
  return FALLBACK_ACCENT
}

type NoiseFieldProps = {
  className?: string;
  color?: string;
  scale?: number;
  speed?: number;
  density?: number;
  cell?: number;
  octaves?: number;
  flow?: { x: number; y: number };
}

export function NoiseField({
  className,
  color,
  scale = 0.014,
  speed = 1,
  density = 0.52,
  cell = 6,
  octaves = 3,
  flow = { x: 0.08, y: 0.04 },
}: NoiseFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const element = canvasRef.current
    if (!element) return
    const canvas: HTMLCanvasElement = element
    const maybeContext = canvas.getContext('2d')
    if (!maybeContext) return
    const context: CanvasRenderingContext2D = maybeContext

    const perlin = createPerlin()
    const safeOctaves = Math.max(1, Math.min(5, Math.floor(octaves)))
    const safeCell = Math.max(2, Math.floor(cell))
    const safeDensity = Math.max(0, Math.min(0.95, density))

    function fbm(x: number, y: number) {
      let value = 0
      let amplitude = 0.5
      let frequency = 1
      let norm = 0
      for (let i = 0; i < safeOctaves; i += 1) {
        value += amplitude * perlin(x * frequency, y * frequency)
        norm += amplitude
        amplitude *= 0.5
        frequency *= 2
      }
      return value / norm
    }

    function cellHash(col: number, row: number) {
      let h = (col | 0) * 374761393 + (row | 0) * 668265263
      h = Math.imul(h ^ (h >>> 13), 1274126177)
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295
    }

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
      const time = reducedMotion ? 0 : ((now - start) / 1000) * speed
      context.clearRect(0, 0, width, height)
      if (width < 4 || height < 4) {
        raf = window.requestAnimationFrame(draw)
        return
      }

      const cols = Math.ceil(width / safeCell)
      const rows = Math.ceil(height / safeCell)
      const ox = time * flow.x
      const oy = time * flow.y

      for (let row = 0; row < rows; row += 1) {
        const ny = row * scale + oy
        for (let col = 0; col < cols; col += 1) {
          const nx = col * scale + ox
          const raw = fbm(nx, ny)
          const v = (raw + 1) * 0.5
          if (v < safeDensity) continue

          const jitter = cellHash(col, row)
          const lit = (v - safeDensity) / (1 - safeDensity)
          if (jitter > lit) continue

          let alpha = 0.25 + lit * 0.75
          if (jitter < 0.22 && !reducedMotion) {
            alpha *= 0.55 + 0.45 * (Math.sin(time * 3.2 + jitter * 28) * 0.5 + 0.5)
          }
          if (alpha > 1) alpha = 1

          context.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${alpha.toFixed(3)})`
          context.fillRect(col * safeCell, row * safeCell, safeCell - 1, safeCell - 1)
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
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-theme', 'data-accent'],
    })
    resize()
    start = performance.now()
    draw(start)

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [color, scale, speed, density, cell, octaves, flow.x, flow.y])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
