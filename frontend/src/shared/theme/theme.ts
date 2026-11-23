import { theme, type ThemeConfig } from 'antd'
import type { Preferences } from '@/features/preferences/store/preferences.slice'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'
export const THEME_COLORS = { light: '#f5f6fa', dark: '#11121a' }

export function resolveTheme(mode: Preferences['theme'], prefersDark: boolean) {
  return mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
}

export function createAntTheme(mode: 'light' | 'dark'): ThemeConfig {
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    cssVar: { key: 'viraboard' },
    token: {
      colorPrimary: mode === 'dark' ? '#a39cff' : '#635bff',
      colorBgLayout: THEME_COLORS[mode],
      borderRadius: 12,
      fontFamily: 'Tahoma, "Segoe UI", sans-serif',
    },
  }
}
