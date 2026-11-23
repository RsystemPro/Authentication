import type {
  BaseQueryApi,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  QueryReturnValue,
} from '@reduxjs/toolkit/query'

export type AuthRequest = string | FetchArgs
export type AuthResult = QueryReturnValue<
  unknown,
  FetchBaseQueryError,
  FetchBaseQueryMeta
>
export type AuthStore = Pick<BaseQueryApi, 'dispatch' | 'getState'>

export interface AuthOptions {
  public?: boolean
  session?: 'restore' | 'login' | 'end' | 'revoke'
  reauthenticate?: boolean
}
