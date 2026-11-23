import {
  credentialsReceived,
  restorationFailed,
  signedOut,
  type AuthState,
} from '@/features/auth/store/auth.slice'
import {
  credentialsSchema,
  sessionId,
  type Credentials,
} from '@/features/auth/types/auth.types'
import type { AuthStore } from './types'

export function readCredentialsResponse(data: unknown): Credentials | null {
  const parsed = credentialsSchema.safeParse(data)
  if (!parsed.success) return null
  return {
    ...parsed.data,
    expiresAt: Date.now() + parsed.data.expiresIn * 1000,
  }
}

// All credentials live in Redux memory; this class never uses browser storage.
export class AuthSession {
  private readonly store: AuthStore
  // Changes on sign-out or a switch of user/session. Requests keep a copy so
  // an old response cannot restore a session that has since been replaced.
  version = 0

  constructor(store: AuthStore) {
    this.store = store
  }

  get state() {
    return (this.store.getState() as { auth: AuthState }).auth
  }

  hasUsableCredentials() {
    return (this.state.credentials?.expiresAt ?? 0) > Date.now() + 10_000
  }

  receive(credentials: Credentials, { resetCache = true } = {}) {
    const previous = this.state.credentials
    const differentUser = previous?.user.id !== credentials.user.id
    const differentSession =
      sessionId(previous?.accessToken) !== sessionId(credentials.accessToken)

    if (differentUser || differentSession) {
      this.version++
      if (resetCache) this.clearPrivateCache()
    }
    this.store.dispatch(credentialsReceived(credentials))
  }

  clear({ resetCache = true } = {}) {
    this.version++
    this.store.dispatch(signedOut())
    if (resetCache) this.clearPrivateCache()
  }

  restorationFailed() {
    // A temporary server failure does not invalidate existing credentials.
    this.store.dispatch(restorationFailed())
  }

  private clearPrivateCache() {
    this.store.dispatch({ type: 'api/resetApiState' })
  }
}
