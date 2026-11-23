import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/shared/constants/routes'

export function Component() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title={t('errors.notFound')}
      subTitle={t('errors.notFoundDescription')}
      extra={
        <Button type="primary" onClick={() => void navigate(ROUTES.dashboard)}>
          {t('common.home')}
        </Button>
      }
    />
  )
}
