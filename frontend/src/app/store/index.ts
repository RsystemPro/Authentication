import {
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import {
  preferencesReducer,
  setLanguage,
  setTheme,
  writePreferences,
} from '@/features/preferences/store/preferences.slice'
import { baseApi } from '@/services/api/base-api'
import { authReducer } from '@/features/auth/store/auth.slice'
import { authApi } from '@/features/auth/api/auth.api'

export function createAppStore() {
  const preferencesListener = createListenerMiddleware()
  const store = configureStore({
    reducer: {
      auth: authReducer,
      preferences: preferencesReducer,
      [baseApi.reducerPath]: baseApi.reducer,
      [authApi.reducerPath]: authApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(preferencesListener.middleware)
        .concat(baseApi.middleware, authApi.middleware),
    // Auth requests contain passwords and in-memory credentials.
    devTools: false,
  })

  preferencesListener.startListening({
    matcher: isAnyOf(setLanguage, setTheme),
    effect: (_, api) => {
      writePreferences(
        (api.getState() as ReturnType<typeof store.getState>).preferences,
      )
    },
  })

  return store
}

export const store = createAppStore()
setupListeners(store.dispatch)

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
