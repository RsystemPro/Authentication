import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/app/store'
import { accountApi, authApi } from '@/features/auth/api/auth.api'
import { credentialsReceived } from '@/features/auth/store/auth.slice'
import { credentials, currentSessionId, signIn, user } from '@/test/auth'
import { server } from '@/test/server'
import { baseApi } from './base-api'
import { getAuthClient } from './auth-client'

const testApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    privateRecord: build.query<{ value: string }, string>({
      query: (id) => `records/${id}`,
    }),
  }),
})
const url = 'http://localhost/api'

describe('authentication transport', () => {
  it('allows password recovery to complete while startup rejects an expired session', async () => {
    const store = createAppStore()
    server.use(
      http.post(`${url}/auth/refresh`, async () => {
        await delay(30)
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(
        `${url}/auth/reset-password`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    const restore = store.dispatch(authApi.endpoints.restoreSession.initiate())
    const reset = store.dispatch(
      authApi.endpoints.resetPassword.initiate({
        token: 'a'.repeat(43),
        newPassword: 'a distinctive new passphrase',
      }),
    )
    await expect(restore.unwrap()).resolves.toBeNull()
    await expect(reset.unwrap()).resolves.toBeNull()
    expect(store.getState().auth.status).toBe('anonymous')
    restore.unsubscribe()
    reset.reset()
  })

  it('sends credentials and CSRF, keeps login secrets out of API response data', async () => {
    const store = createAppStore()
    server.use(
      http.post(`${url}/auth/login`, async ({ request }) => {
        expect(request.credentials).toBe('include')
        expect(request.headers.get('x-csrf-protection')).toBe('1')
        expect(await request.json()).toEqual({
          email: user.email,
          password: 'a unique long passphrase',
        })
        return HttpResponse.json(credentials())
      }),
    )
    const login = store.dispatch(
      authApi.endpoints.login.initiate({
        email: user.email,
        password: 'a unique long passphrase',
      }),
    )
    expect(await login.unwrap()).toBeNull()
    expect(store.getState().auth.credentials?.user.email).toBe(user.email)
    expect(localStorage.length).toBe(0)
    login.reset()
    expect(JSON.stringify(store.getState().authApi)).not.toContain('passphrase')
  })

  it('coalesces concurrent 401s into one refresh and retries each request once', async () => {
    const store = createAppStore()
    signIn(store, 'old')
    let refreshes = 0
    let protectedCalls = 0
    server.use(
      http.get(`${url}/records/:id`, ({ request }) => {
        protectedCalls++
        return request.headers.get('authorization')?.endsWith('.fresh')
          ? HttpResponse.json({ value: 'private' })
          : new HttpResponse(null, { status: 401 })
      }),
      http.post(`${url}/auth/refresh`, async () => {
        refreshes++
        await delay(40)
        return HttpResponse.json(credentials())
      }),
    )
    const requests = ['a', 'b'].map((id) =>
      store.dispatch(testApi.endpoints.privateRecord.initiate(id)),
    )
    await expect(
      Promise.all(requests.map((request) => request.unwrap())),
    ).resolves.toEqual([{ value: 'private' }, { value: 'private' }])
    expect(refreshes).toBe(1)
    expect(protectedCalls).toBe(4)
    requests.forEach((request) => request.unsubscribe())
    store.dispatch(baseApi.util.resetApiState())
  })

  it('deduplicates restoration across tabs with a lock and peer credentials', async () => {
    const first = createAppStore()
    const second = createAppStore()
    getAuthClient(first).connect()
    getAuthClient(second).connect()
    let refreshes = 0
    server.use(
      http.post(`${url}/auth/refresh`, async () => {
        refreshes++
        await delay(20)
        return HttpResponse.json(credentials())
      }),
    )
    await Promise.all(
      [first, second].map((store) =>
        store.dispatch(authApi.endpoints.restoreSession.initiate()).unwrap(),
      ),
    )
    expect(refreshes).toBe(1)
    expect(first.getState().auth.status).toBe('authenticated')
    expect(second.getState().auth.status).toBe('authenticated')
  })

  it('preserves credentials on temporary refresh errors, and does not retry automatically', async () => {
    const store = createAppStore()
    signIn(store, 'old')
    let refreshes = 0
    server.use(
      http.get(
        `${url}/records/:id`,
        () => new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${url}/auth/refresh`, () => {
        refreshes++
        return new HttpResponse(null, { status: 503 })
      }),
    )
    const request = store.dispatch(
      testApi.endpoints.privateRecord.initiate('a'),
    )
    await expect(request.unwrap()).rejects.toMatchObject({ status: 503 })
    expect(store.getState().auth.status).toBe('authenticated')
    expect(refreshes).toBe(1)
    request.unsubscribe()
    store.dispatch(baseApi.util.resetApiState())
  })

  it('clears private cached data and all tabs after successful logout', async () => {
    const first = createAppStore()
    const second = createAppStore()
    signIn(first)
    signIn(second)
    getAuthClient(first).connect()
    getAuthClient(second).connect()
    server.use(
      http.get(`${url}/records/:id`, () =>
        HttpResponse.json({ value: 'private' }),
      ),
      http.post(
        `${url}/auth/logout`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    const request = second.dispatch(
      testApi.endpoints.privateRecord.initiate('a'),
    )
    await expect(request.unwrap()).resolves.toEqual({ value: 'private' })
    await expect(
      first.dispatch(authApi.endpoints.logout.initiate()).unwrap(),
    ).resolves.toBeNull()
    await vi.waitFor(() =>
      expect(second.getState().auth.status).toBe('anonymous'),
    )
    expect(Object.keys(second.getState().api.queries)).toHaveLength(0)
    expect(first.getState().auth.credentials).toBeNull()
    request.unsubscribe()
  })

  it('does not claim logout succeeded when the server is unavailable', async () => {
    const store = createAppStore()
    signIn(store)
    server.use(
      http.post(
        `${url}/auth/logout`,
        () => new HttpResponse(null, { status: 503 }),
      ),
    )
    await expect(
      store.dispatch(authApi.endpoints.logout.initiate()).unwrap(),
    ).rejects.toMatchObject({ status: 503 })
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('rejects invalid refresh credentials and clears the session', async () => {
    const store = createAppStore()
    store.dispatch(credentialsReceived({ ...credentials(), expiresAt: 0 }))
    server.use(
      http.post(
        `${url}/auth/refresh`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    )
    await store.dispatch(authApi.endpoints.restoreSession.initiate()).unwrap()
    expect(store.getState().auth.status).toBe('anonymous')
  })

  it('stops after one retry when the replacement access token is also rejected', async () => {
    const store = createAppStore()
    signIn(store, 'old')
    let protectedCalls = 0
    let refreshes = 0
    server.use(
      http.get(`${url}/records/:id`, () => {
        protectedCalls++
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${url}/auth/refresh`, () => {
        refreshes++
        return HttpResponse.json(credentials())
      }),
    )

    // Use the transport directly: signing out also removes RTK Query entries.
    const result = await getAuthClient(store).execute(
      'records/rejected-replacement',
      {
        ...store,
        signal: new AbortController().signal,
        abort: vi.fn(),
        extra: undefined,
        endpoint: 'privateRecord',
        type: 'query',
      },
    )
    expect(result.error).toMatchObject({ status: 401 })
    expect(protectedCalls).toBe(2)
    expect(refreshes).toBe(1)
    expect(store.getState().auth.credentials).toBeNull()
  })

  it('rejects malformed refresh responses without accepting credentials', async () => {
    const store = createAppStore()
    server.use(
      http.post(`${url}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'incomplete-response' }),
      ),
    )

    const restore = store.dispatch(authApi.endpoints.restoreSession.initiate())
    await expect(restore.unwrap()).rejects.toMatchObject({
      status: 'CUSTOM_ERROR',
      error: 'Invalid authentication response',
    })
    expect(store.getState().auth.credentials).toBeNull()
    expect(store.getState().auth.status).toBe('unavailable')
    restore.unsubscribe()
  })

  it('does not rotate the cookie when cross-tab locking is unavailable', async () => {
    const store = createAppStore()
    const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')!
    let refreshes = 0
    server.use(
      http.post(`${url}/auth/refresh`, () => {
        refreshes++
        return HttpResponse.json(credentials())
      }),
    )

    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })
    const restore = store.dispatch(authApi.endpoints.restoreSession.initiate())
    try {
      await expect(restore.unwrap()).rejects.toMatchObject({
        status: 'CUSTOM_ERROR',
        error: 'AUTH_COORDINATION_UNAVAILABLE',
      })
      expect(refreshes).toBe(0)
      expect(store.getState().auth.status).toBe('unavailable')
    } finally {
      Object.defineProperty(navigator, 'locks', originalLocks)
      restore.unsubscribe()
    }
  })

  it('does not refresh or repeat a change-password request for an incorrect current password', async () => {
    const store = createAppStore()
    signIn(store)
    let requests = 0
    server.use(
      http.post(`${url}/auth/change-password`, () => {
        requests++
        return new HttpResponse(null, { status: 401 })
      }),
    )
    await expect(
      store
        .dispatch(
          authApi.endpoints.changePassword.initiate({
            currentPassword: 'wrong',
            newPassword: 'a distinctive new passphrase',
          }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 401 })
    expect(requests).toBe(1)
    expect(store.getState().auth.status).toBe('authenticated')
  })

  it('signs out after password changes and current-session revocation', async () => {
    server.use(
      http.post(
        `${url}/auth/change-password`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.delete(
        `${url}/auth/sessions/:id`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )
    for (const action of ['password', 'revoke']) {
      const store = createAppStore()
      signIn(store)
      if (action === 'password')
        await store
          .dispatch(
            authApi.endpoints.changePassword.initiate({
              currentPassword: 'previous',
              newPassword: 'a distinctive new passphrase',
            }),
          )
          .unwrap()
      else
        await store
          .dispatch(
            accountApi.endpoints.revokeSession.initiate(currentSessionId),
          )
          .unwrap()
      expect(store.getState().auth.status).toBe('anonymous')
    }
  })
})
