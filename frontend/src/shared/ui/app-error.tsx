import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'

export function AppError() {
  const { t } = useTranslation()
  return (
    <Result
      status="error"
      title={t('errors.title')}
      subTitle={t('errors.description')}
      extra={
        <Button type="primary" onClick={() => window.location.reload()}>
          {t('common.reload')}
        </Button>
      }
    />
  )
}
