import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { server } from '@/test/server'
import { baseApi } from './base-api'

const testApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTestRecord: build.query<{ name: string }, void>({
      query: () => 'test-record',
      extraOptions: { public: true },
    }),
  }),
})

describe('API foundation', () => {
  it('shares cached server data and only sends one request', async () => {
    let requests = 0
    server.use(
      http.get('http://localhost/api/test-record', () => {
        requests += 1
        return HttpResponse.json({ name: 'Example' })
      }),
    )
    const store = createAppStore()
    try {
      const first = store.dispatch(testApi.endpoints.getTestRecord.initiate())
      await expect(first.unwrap()).resolves.toEqual({ name: 'Example' })
      const second = store.dispatch(testApi.endpoints.getTestRecord.initiate())
      await expect(second.unwrap()).resolves.toEqual({ name: 'Example' })
      expect(requests).toBe(1)
      first.unsubscribe()
      second.unsubscribe()
    } finally {
      store.dispatch(baseApi.util.resetApiState())
    }
  })

  it('exposes API failures for feature error handling', async () => {
    server.use(
      http.get('http://localhost/api/test-record', () =>
        HttpResponse.json({ message: 'Unavailable' }, { status: 503 }),
      ),
    )
    const store = createAppStore()
    try {
      const request = store.dispatch(testApi.endpoints.getTestRecord.initiate())
      await expect(request.unwrap()).rejects.toMatchObject({ status: 503 })
      request.unsubscribe()
    } finally {
      store.dispatch(baseApi.util.resetApiState())
    }
  })
})
