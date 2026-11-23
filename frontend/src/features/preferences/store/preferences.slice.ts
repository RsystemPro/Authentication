import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { z } from 'zod'

export const PREFERENCES_KEY = 'viraboard.preferences.v1'
export const preferencesSchema = z.object({
  language: z.enum(['fa', 'en']).catch('fa'),
  theme: z.enum(['system', 'light', 'dark']).catch('system'),
})
export type Preferences = z.infer<typeof preferencesSchema>
export const defaultPreferences: Preferences = {
  language: 'fa',
  theme: 'system',
}

export function readPreferences(): Preferences {
  try {
    return preferencesSchema.parse(
      JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}'),
    )
  } catch {
    return { ...defaultPreferences }
  }
}

export function writePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // In-memory preferences remain usable when browser storage is unavailable.
  }
}

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: readPreferences,
  reducers: {
    setLanguage(state, action: PayloadAction<Preferences['language']>) {
      state.language = action.payload
    },
    setTheme(state, action: PayloadAction<Preferences['theme']>) {
      state.theme = action.payload
    },
  },
})

export const { setLanguage, setTheme } = preferencesSlice.actions
export const preferencesReducer = preferencesSlice.reducer
