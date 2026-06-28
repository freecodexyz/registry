import { useEffect, useState } from 'react'
import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'registry-theme'
const MODES: ThemeMode[] = ['light', 'dark', 'system']

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function iconForMode(mode: ThemeMode) {
  if (mode === 'light') return <FiSun aria-hidden="true" focusable="false" />
  if (mode === 'dark') return <FiMoon aria-hidden="true" focusable="false" />

  return <FiMonitor aria-hidden="true" focusable="false" />
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
