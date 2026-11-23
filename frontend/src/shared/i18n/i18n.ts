import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { readPreferences } from '@/features/preferences/store/preferences.slice'
import { resources } from './resources'

export function createI18n(language = readPreferences().language) {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'fa',
    supportedLngs: ['fa', 'en'],
    resources,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  return instance
}

export const i18n = createI18n()
