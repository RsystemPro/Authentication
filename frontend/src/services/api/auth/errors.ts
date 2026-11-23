import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { AuthResult } from './types'

export function coordinationUnavailable(): AuthResult {
  return {
    error: { status: 'CUSTOM_ERROR', error: 'AUTH_COORDINATION_UNAVAILABLE' },
  }
}

export function invalidCredentialsResponse(): AuthResult {
  return {
    error: { status: 'CUSTOM_ERROR', error: 'Invalid authentication response' },
  }
}

export function authErrorKey(error: unknown): string {
  const result = error as FetchBaseQueryError | undefined
  if (
    result?.status === 'CUSTOM_ERROR' &&
    result.error === 'AUTH_COORDINATION_UNAVAILABLE'
  )
    return 'coordination'
  if (result?.status === 401) return 'credentials'
  if (result?.status === 400) return 'invalid'
  if (result?.status === 403) return 'origin'
  if (result?.status === 429) return 'rateLimit'
  return 'unavailable'
}
