import { Card, Select, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import {
  setLanguage,
  setTheme,
  type Preferences,
} from '../store/preferences.slice'
import styles from './settings.module.css'

export function Component() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { language, theme } = useAppSelector((state) => state.preferences)

  return (
    <section className={styles.page}>
      <Typography.Title level={1}>{t('settings.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('settings.description')}
      </Typography.Paragraph>
      <Card title={t('settings.appearance')}>
        <div className={styles.field}>
          <label htmlFor="theme">{t('settings.theme')}</label>
          <Select<Preferences['theme']>
            id="theme"
            virtual={false}
            value={theme}
            onChange={(value) => dispatch(setTheme(value))}
            options={(['system', 'light', 'dark'] as const).map((value) => ({
              value,
              label: t(`settings.${value}`),
            }))}
          />
        </div>
      </Card>
      <Card title={t('settings.language')}>
        <div className={styles.field}>
          <label htmlFor="language">{t('settings.language')}</label>
          <Select<Preferences['language']>
            id="language"
            virtual={false}
            value={language}
            onChange={(value) => dispatch(setLanguage(value))}
            options={[
              { value: 'fa', label: 'فارسی' },
              { value: 'en', label: 'English' },
            ]}
          />
          <Typography.Text type="secondary">
            {t('settings.languageDescription')}
          </Typography.Text>
        </div>
      </Card>
    </section>
  )
}
