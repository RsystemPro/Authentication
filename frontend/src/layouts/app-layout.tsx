import { Alert, Button, Layout, Space, Typography } from 'antd'
import { ArrowUpRight, LayoutDashboard, Settings, Shapes } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate, useNavigation } from 'react-router-dom'
import { ROUTES } from '@/shared/constants/routes'
import { PageLoader } from '@/shared/ui/page-loader'
import styles from './app-layout.module.css'
import { useLogoutMutation } from '@/features/auth/api/auth.api'
import { authErrorKey } from '@/services/api/auth-client'
import { useAppSelector } from '@/app/store/hooks'
import { useState } from 'react'

export function AppLayout() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [logout, logoutState] = useLogoutMutation()
  const [logoutError, setLogoutError] = useState<string>()
  const email = useAppSelector((state) => state.auth.credentials?.user.email)
  const links = [
    { to: ROUTES.dashboard, icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: ROUTES.settings, icon: Settings, label: t('nav.settings') },
    { to: '/account', icon: Settings, label: t('auth.account') },
  ]

  return (
    <Layout className={styles.shell}>
      <a className="skip-link" href="#main-content">
        {t('nav.skip')}
      </a>
      <aside className={styles.sidebar}>
        <NavLink
          to={ROUTES.dashboard}
          className={styles.brand}
          aria-label={t('app.name')}
        >
          <span className={styles.logo}>
            <Shapes size={24} aria-hidden="true" />
          </span>
          <span>
            {t('app.name')}
            <small>{t('app.tagline')}</small>
          </span>
        </NavLink>
        <nav aria-label={t('nav.label')} className={styles.navigation}>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarNote}>
          <span className={styles.noteMark} aria-hidden="true">
            ✳
          </span>
          <Typography.Text>{t('app.tagline')}</Typography.Text>
        </div>
      </aside>
      <Layout className={styles.main}>
        <header className={styles.header}>
          <Typography.Text type="secondary" ellipsis dir="ltr">
            {email}
          </Typography.Text>
          <Space wrap>
            <Button
              onClick={() => void navigate(ROUTES.settings)}
              icon={<ArrowUpRight size={16} aria-hidden="true" />}
            >
              {t('dashboard.preferences')}
            </Button>
            <Button
              loading={logoutState.isLoading}
              onClick={() => {
                setLogoutError(undefined)
                void logout()
                  .unwrap()
                  .catch((error: unknown) =>
                    setLogoutError(authErrorKey(error)),
                  )
                  .finally(() => logoutState.reset())
              }}
            >
              {t('auth.logout')}
            </Button>
          </Space>
        </header>
        {logoutError && (
          <Alert
            role="alert"
            type="error"
            title={t('auth.logoutFailed')}
            description={t(`auth.errors.${logoutError}`)}
          />
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className={styles.content}
          aria-busy={navigation.state !== 'idle'}
        >
          {navigation.state === 'loading' ? <PageLoader /> : <Outlet />}
        </main>
        <footer className={styles.footer}>
          {t('app.name')} <span aria-hidden="true">·</span> {t('app.tagline')}
        </footer>
      </Layout>
    </Layout>
  )
}
