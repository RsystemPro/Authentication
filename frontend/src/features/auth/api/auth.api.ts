import { createApi } from '@reduxjs/toolkit/query/react'
import { baseApi, baseQuery } from '@/services/api/base-api'
import type { LoginInput, Session, User } from '../types/auth.types'
import type { BaseQueryApi } from '@reduxjs/toolkit/query'
import type { AuthState } from '../store/auth.slice'

async function clearCacheAfterSuccess(
  _: unknown,
  {
    dispatch,
    getState,
    queryFulfilled,
  }: Pick<BaseQueryApi, 'dispatch' | 'getState'> & {
    queryFulfilled: Promise<unknown>
  },
) {
  const before = (getState() as { auth: AuthState }).auth.credentials
  try {
    await queryFulfilled
    if (before !== (getState() as { auth: AuthState }).auth.credentials)
      dispatch(baseApi.util.resetApiState())
  } catch {
    /* Failed operations preserve the current session and its cache. */
  }
}

const post = (url: string, body: unknown = {}) => ({
  url: `auth/${url}`,
  method: 'POST',
  body,
})
// Commands have a separate cache so clearing private data cannot abort sign-in/recovery.
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  keepUnusedDataFor: 0,
  endpoints: (build) => ({
    restoreSession: build.query<null, void>({
      query: () => post('refresh'),
      extraOptions: { session: 'restore' },
      keepUnusedDataFor: 0,
    }),
    login: build.mutation<null, LoginInput>({
      onQueryStarted: clearCacheAfterSuccess,
      query: (body) => post('login', body),
      extraOptions: { public: true, session: 'login' },
    }),
    register: build.mutation<{ message: string }, LoginInput>({
      query: (body) => post('register', body),
      extraOptions: { public: true },
    }),
    resendVerification: build.mutation<{ message: string }, { email: string }>({
      query: (body) => post('resend-verification', body),
      extraOptions: { public: true },
    }),
    forgotPassword: build.mutation<{ message: string }, { email: string }>({
      query: (body) => post('forgot-password', body),
      extraOptions: { public: true },
    }),
    verifyEmail: build.mutation<void, { token: string }>({
      query: (body) => post('verify-email', body),
      extraOptions: { public: true },
    }),
    resetPassword: build.mutation<void, { token: string; newPassword: string }>(
      {
        onQueryStarted: clearCacheAfterSuccess,
        query: (body) => post('reset-password', body),
        extraOptions: { public: true, session: 'end' },
      },
    ),
    logout: build.mutation<void, void>({
      onQueryStarted: clearCacheAfterSuccess,
      query: () => post('logout'),
      extraOptions: { public: true, session: 'end' },
    }),
    logoutAll: build.mutation<void, void>({
      onQueryStarted: clearCacheAfterSuccess,
      query: () => post('logout-all'),
      extraOptions: { session: 'end' },
    }),
    changePassword: build.mutation<
      void,
      { currentPassword: string; newPassword: string }
    >({
      onQueryStarted: clearCacheAfterSuccess,
      query: (body) => post('change-password', body),
      extraOptions: { session: 'end', reauthenticate: false },
    }),
  }),
})
export const accountApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    me: build.query<User, void>({
      query: () => 'auth/me',
      providesTags: ['User'],
    }),
    sessions: build.query<
      { items: Session[]; nextCursor: string | null },
      string | undefined
    >({
      query: (cursor) => ({
        url: 'auth/sessions',
        params: { limit: 20, ...(cursor ? { cursor } : {}) },
      }),
      providesTags: ['Sessions'],
    }),
    revokeSession: build.mutation<void, string>({
      onQueryStarted: clearCacheAfterSuccess,
      query: (id) => ({ url: `auth/sessions/${id}`, method: 'DELETE' }),
      extraOptions: { session: 'revoke' },
      invalidatesTags: ['Sessions'],
    }),
  }),
})
export const {
  useRestoreSessionQuery,
  useLoginMutation,
  useRegisterMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useVerifyEmailMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useChangePasswordMutation,
} = authApi
export const { useMeQuery, useSessionsQuery, useRevokeSessionMutation } =
  accountApi
