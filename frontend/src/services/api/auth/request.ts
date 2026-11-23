import { fetchBaseQuery, type BaseQueryApi } from '@reduxjs/toolkit/query'
import type { AuthState } from '@/features/auth/store/auth.slice'
import { env } from '@/shared/config/env'
import type { AuthRequest, AuthResult } from './types'

const rawQuery = fetchBaseQuery({
  baseUrl: env.VITE_API_BASE_URL,
  // The browser sends the HttpOnly refresh cookie. JavaScript never reads it.
  credentials: 'include',
  timeout: 15_000,
  prepareHeaders: (headers, { getState, arg }) => {
    const method =
      typeof arg === 'string' ? 'GET' : (arg.method?.toUpperCase() ?? 'GET')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method))
      headers.set('X-CSRF-Protection', '1')

    const { credentials } = (getState() as { auth: AuthState }).auth
    if (credentials)
      headers.set('Authorization', `Bearer ${credentials.accessToken}`)
    return headers
  },
})

export async function sendAuthRequest(
  args: AuthRequest,
  api: BaseQueryApi,
): Promise<AuthResult> {
  const request = typeof args === 'string' ? { url: args } : args
  return rawQuery({ ...request, cache: 'no-store' }, api, {})
}
