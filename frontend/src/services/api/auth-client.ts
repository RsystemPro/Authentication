import type { BaseQueryApi } from '@reduxjs/toolkit/query'
import { sessionId, type Credentials } from '@/features/auth/types/auth.types'
import { invalidCredentialsResponse } from './auth/errors'
import { sendAuthRequest } from './auth/request'
import { AuthSession, readCredentialsResponse } from './auth/session'
import { AuthTabs } from './auth/tabs'
import type {
  AuthOptions,
  AuthRequest,
  AuthResult,
  AuthStore,
} from './auth/types'

export { authErrorKey } from './auth/errors'
export type { AuthOptions } from './auth/types'

// Request flow lives here. HTTP details, Redux state and browser tab APIs each
// have their own file in ./auth. One client belongs to one Redux store.
export class AuthClient {
  private readonly session: AuthSession
  private readonly tabs: AuthTabs
  private pendingRefresh?: Promise<AuthResult>

  constructor(store: AuthStore) {
    this.session = new AuthSession(store)
    this.tabs = new AuthTabs({
      getUsableCredentials: () =>
        this.session.hasUsableCredentials()
          ? this.session.state.credentials
          : null,
      onCredentials: (credentials) => this.session.receive(credentials),
      onLogout: () => this.session.clear(),
    })
  }

  connect() {
    this.tabs.connect()
  }

  disconnect() {
    this.tabs.disconnect()
  }

  private saveCredentials(
    credentials: Credentials,
    { resetCache = true } = {},
  ) {
    this.session.receive(credentials, { resetCache })
    this.tabs.shareCredentials(credentials)
  }

  private signOut({ resetCache = true } = {}) {
    this.session.clear({ resetCache })
    this.tabs.shareLogout()
  }

  private hasNewerCredentials(failedToken?: string) {
    return (
      this.session.hasUsableCredentials() &&
      this.session.state.credentials?.accessToken !== failedToken
    )
  }

  // Caller must hold the shared tab lock before entering this method.
  private async refreshWhileLocked(
    api: BaseQueryApi,
    failedToken?: string,
  ): Promise<AuthResult> {
    if (this.hasNewerCredentials(failedToken)) return { data: null }

    // Another tab may already have rotated the cookie. Ask for its access token
    // after acquiring the lock, before attempting another rotation ourselves.
    await this.tabs.requestCredentials()
    if (this.hasNewerCredentials(failedToken)) return { data: null }

    const versionBeforeRefresh = this.session.version
    const result = await sendAuthRequest(
      { url: 'auth/refresh', method: 'POST', body: {} },
      api,
    )
    if (result.error) {
      if (result.error.status === 401) this.signOut()
      else this.session.restorationFailed()
      return result
    }

    const credentials = readCredentialsResponse(result.data)
    if (!credentials) return invalidCredentialsResponse()
    if (versionBeforeRefresh === this.session.version)
      this.saveCredentials(credentials)
    return { data: null }
  }

  private refresh(
    api: BaseQueryApi,
    lockAlreadyHeld = false,
    failedToken?: string,
  ): Promise<AuthResult> {
    // Reacquiring our own lock would deadlock a logout or another auth command.
    if (lockAlreadyHeld) return this.refreshWhileLocked(api, failedToken)

    // Concurrent requests in this tab wait for the same refresh promise.
    if (!this.pendingRefresh) {
      this.pendingRefresh = this.tabs
        .runExclusively(() => this.refreshWhileLocked(api, failedToken))
        .finally(() => {
          this.pendingRefresh = undefined
        })
    }
    return this.pendingRefresh
  }

  private async restoreSession(api: BaseQueryApi): Promise<AuthResult> {
    const result = await this.refresh(api)
    // Having no valid refresh cookie is a normal anonymous startup.
    if (result.error?.status === 401) return { data: null }
    if (result.error) this.session.restorationFailed()
    return result
  }

  async execute(
    args: AuthRequest,
    api: BaseQueryApi,
    options: AuthOptions = {},
  ): Promise<AuthResult> {
    this.connect()
    if (options.session === 'restore') return this.restoreSession(api)

    if (options.session)
      return this.tabs.runExclusively(() =>
        this.executeRequest(args, api, options, true),
      )
    return this.executeRequest(args, api, options, false)
  }

  private async executeRequest(
    args: AuthRequest,
    api: BaseQueryApi,
    options: AuthOptions,
    lockAlreadyHeld: boolean,
  ): Promise<AuthResult> {
    // 1. Ensure protected requests start with a usable access token.
    if (!options.public && !this.session.hasUsableCredentials()) {
      if (this.session.state.status === 'anonymous')
        return { error: { status: 401, data: null } }
      const refreshed = await this.refresh(api, lockAlreadyHeld)
      if (refreshed.error) return refreshed
    }

    const tokenBeforeRequest = this.session.state.credentials?.accessToken
    const currentSession = sessionId(tokenBeforeRequest)
    const versionBeforeRequest = this.session.version
    let result = await sendAuthRequest(args, api)

    // 2. A rejected access token gets one refresh and one retry.
    if (
      !options.public &&
      options.reauthenticate !== false &&
      result.error?.status === 401
    ) {
      const refreshed = await this.refresh(
        api,
        lockAlreadyHeld,
        tokenBeforeRequest,
      )
      if (refreshed.error) return refreshed
      result = await sendAuthRequest(args, api)
      if (result.error?.status === 401) this.signOut()
    }

    // 3. Discard results belonging to a session that ended during the request.
    if (versionBeforeRequest !== this.session.version)
      return { error: { status: 401, data: null } }
    if (result.error) return result

    // 4. Successful auth commands update memory and notify the other tabs.
    // Their API lifecycle clears private caches after the command completes,
    // so that clearing a cache cannot cancel the command itself.
    if (options.session === 'login') {
      const credentials = readCredentialsResponse(result.data)
      if (!credentials) return invalidCredentialsResponse()
      this.saveCredentials(credentials, { resetCache: false })
      return { data: null }
    }

    const revokedCurrentSession =
      options.session === 'revoke' &&
      typeof args !== 'string' &&
      args.url === `auth/sessions/${currentSession}`
    if (options.session === 'end' || revokedCurrentSession)
      this.signOut({ resetCache: false })
    return result
  }
}

const clients = new WeakMap<AuthStore['getState'], AuthClient>()
export function getAuthClient(store: AuthStore) {
  let client = clients.get(store.getState)
  if (!client) {
    client = new AuthClient(store)
    clients.set(store.getState, client)
  }
  return client
}
