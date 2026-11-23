import { credentialsReceived } from '@/features/auth/store/auth.slice'
import type { AppStore } from '@/app/store'

export const user = {
  id: '2f613c44-2099-4209-9f99-5fce4670bf95',
  email: 'person@example.com',
  emailVerifiedAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
}
export const currentSessionId = '1ec31834-f874-4d88-8ea2-6de9efab1777'
export function credentials(version = 'fresh') {
  return {
    accessToken: `header.${btoa(JSON.stringify({ sid: currentSessionId }))}.${version}`,
    expiresIn: 600,
    user,
  }
}
export function signIn(store: AppStore, version = 'fresh') {
  store.dispatch(
    credentialsReceived({
      ...credentials(version),
      expiresAt: Date.now() + 600_000,
    }),
  )
}
