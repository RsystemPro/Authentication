import { Spin } from 'antd'
import { useTranslation } from 'react-i18next'

export function PageLoader() {
  const { t } = useTranslation()
  return (
    <div className="page-loader" role="status">
      <Spin />
      <span>{t('common.loading')}</span>
    </div>
  )
}
