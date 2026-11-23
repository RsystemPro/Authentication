import {
  createApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { getAuthClient, type AuthOptions } from './auth-client'

export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  AuthOptions
> = (args, api, options) => getAuthClient(api).execute(args, api, options)

// Add feature endpoints through injectEndpoints; keep server data out of UI slices.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['User', 'Sessions'],
  keepUnusedDataFor: 60,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: () => ({}),
})
