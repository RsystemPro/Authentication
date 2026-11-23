import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Credentials } from '../types/auth.types'

export interface AuthState {
  status: 'checking' | 'authenticated' | 'anonymous' | 'unavailable'
  credentials: Credentials | null
}
const initialState: AuthState = { status: 'checking', credentials: null }

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived: (state, action: PayloadAction<Credentials>) => {
      state.credentials = action.payload
      state.status = 'authenticated'
    },
    signedOut: (state) => {
      state.credentials = null
      state.status = 'anonymous'
    },
    restorationFailed: (state) => {
      if (!state.credentials) state.status = 'unavailable'
    },
  },
})
export const { credentialsReceived, signedOut, restorationFailed } =
  slice.actions
export const authReducer = slice.reducer
