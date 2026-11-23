import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/app/store'
import {
  defaultPreferences,
  PREFERENCES_KEY,
  readPreferences,
  setLanguage,
  setTheme,
  writePreferences,
} from './preferences.slice'

describe('browser preferences', () => {
  it('recovers from malformed and unsupported persisted settings', () => {
    localStorage.setItem(PREFERENCES_KEY, '{bad json')
    expect(readPreferences()).toEqual(defaultPreferences)
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ language: 'fr', theme: 'sepia' }),
    )
    expect(readPreferences()).toEqual(defaultPreferences)
  })

  it('persists changes and restores them into a new store', () => {
    const store = createAppStore()
    store.dispatch(setLanguage('en'))
    store.dispatch(setTheme('dark'))
    expect(createAppStore().getState().preferences).toEqual({
      language: 'en',
      theme: 'dark',
    })
  })

  it('keeps preferences usable when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readPreferences()).toEqual(defaultPreferences)
    expect(() =>
      writePreferences({ language: 'en', theme: 'light' }),
    ).not.toThrow()
    const store = createAppStore()
    store.dispatch(setTheme('dark'))
    expect(store.getState().preferences.theme).toBe('dark')
  })
})
