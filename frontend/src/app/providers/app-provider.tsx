import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import faIR from 'antd/locale/fa_IR'
import dayjs from 'dayjs'
import 'dayjs/locale/fa'
import { ErrorBoundary } from 'react-error-boundary'
import { I18nextProvider } from 'react-i18next'
import { Provider } from 'react-redux'
import { store } from '@/app/store'
import { useAppSelector } from '@/app/store/hooks'
import { i18n } from '@/shared/i18n/i18n'
import { AppError } from '@/shared/ui/app-error'
import {
  createAntTheme,
  DARK_MEDIA_QUERY,
  resolveTheme,
  THEME_COLORS,
} from '@/shared/theme/theme'

function subscribeToSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_MEDIA_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function AppConfiguration({ children }: PropsWithChildren) {
  const { language, theme } = useAppSelector((state) => state.preferences)
  const prefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    () => window.matchMedia(DARK_MEDIA_QUERY).matches,
  )
  const mode = resolveTheme(theme, prefersDark)

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr'
    dayjs.locale(language)
    void i18n.changeLanguage(language)
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[mode])
  }, [mode])

  return (
    <I18nextProvider i18n={i18n}>
      <ConfigProvider
        direction={language === 'fa' ? 'rtl' : 'ltr'}
        locale={language === 'fa' ? faIR : enUS}
        theme={createAntTheme(mode)}
      >
        <AntApp>
          <ErrorBoundary FallbackComponent={AppError}>{children}</ErrorBoundary>
        </AntApp>
      </ConfigProvider>
    </I18nextProvider>
  )
}

export function AppProvider({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <AppConfiguration>{children}</AppConfiguration>
    </Provider>
  )
}
