import { useEffect } from 'react'
import { Alert, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useStore } from 'react-redux'
import type { AppStore } from '@/app/store'
import { useAppSelector } from '@/app/store/hooks'
import { getAuthClient, authErrorKey } from '@/services/api/auth-client'
import { PageLoader } from '@/shared/ui/page-loader'
import { useRestoreSessionQuery } from '../api/auth.api'

export function AuthBoundary() {
  const store = useStore<AppStore>()
  const status = useAppSelector((state) => state.auth.status)
  useRestoreSessionQuery(undefined, {
    skip: status === 'authenticated' || status === 'anonymous',
  })
  useEffect(() => {
    const client = getAuthClient(store)
    client.connect()
    return () => client.disconnect()
  }, [store])
  return <Outlet />
}
export function RequireAuth() {
  const { t } = useTranslation()
  const location = useLocation()
  const status = useAppSelector((state) => state.auth.status)
  const { error, refetch } = useRestoreSessionQuery(undefined, {
    skip: status !== 'unavailable',
  })
  if (status === 'checking') return <PageLoader />
  if (status === 'unavailable')
    return (
      <div className="page-loader">
        <Alert
          type="error"
          title={t(`auth.errors.${authErrorKey(error)}`)}
          action={
            <Button onClick={() => void refetch()}>{t('auth.retry')}</Button>
          }
        />
      </div>
    )
  if (status !== 'authenticated')
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  return <Outlet />
}

export function GuestOnly() {
  const status = useAppSelector((state) => state.auth.status)
  if (status === 'checking') return <PageLoader />
  return status === 'authenticated' ? <Navigate to="/" replace /> : <Outlet />
}
