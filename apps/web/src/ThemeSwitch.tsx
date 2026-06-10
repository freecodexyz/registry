import { useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'registry-theme'
const MODES: ThemeMode[] = ['light', 'dark', 'system']

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function iconForMode(mode: ThemeMode) {
  if (mode === 'light') return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.1V1h1.5v2.1H10Zm0 15.9v-2.1h1.5V19H10ZM3.1 5.2 1.6 3.7l1.1-1.1 1.5 1.5-1.1 1.1Zm14.2 12.2-1.5-1.5 1.1-1.1 1.5 1.5-1.1 1.1ZM1 10h2.1v1.5H1V10Zm15.9 0H19v1.5h-2.1V10ZM2.7 18.4l-1.1-1.1 1.5-1.5 1.1 1.1-1.5 1.5ZM16.9 4.2l-1.1-1.1 1.5-1.5 1.1 1.1-1.5 1.5ZM10.75 5.75a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
    </svg>
  )

  if (mode === 'dark') return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M13.8 2.3a8 8 0 1 0 0 15.4A6.35 6.35 0 0 1 13.8 2.3Z" />
    </svg>
  )

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3.5h14v10H3v-10ZM4.5 5v7h11V5h-11Zm3 10h5v1.5h-5V15Zm1.25-2h2.5v2h-2.5v-2Z" />
    </svg>
  )
}

export function ThemeSwitch() {
  const [mode, setMode] = useState(readStoredTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    function applyTheme() {
      const resolvedTheme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode
      document.documentElement.dataset.theme = resolvedTheme
    }

    applyTheme()
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [mode])

  function cycleTheme() {
    setMode((current) => MODES[(MODES.indexOf(current) + 1) % MODES.length])
  }

  return (
    <button className="theme-switch" type="button" onClick={cycleTheme} aria-label={`Theme: ${mode}. Click to switch theme.`} title={`Theme: ${mode}`}>
      <span className="theme-switch__icon" aria-hidden="true">
        {iconForMode(mode)}
      </span>
    </button>
  )
}
