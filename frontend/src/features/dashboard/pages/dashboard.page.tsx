import { Button, Card, Empty, Typography } from 'antd'
import { BookOpen, MessageCircle, PencilRuler, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/shared/constants/routes'
import styles from './dashboard.module.css'

export function Component() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const highlights = [
    { key: 'board', icon: PencilRuler, color: 'purple' },
    { key: 'learn', icon: BookOpen, color: 'green' },
    { key: 'connect', icon: MessageCircle, color: 'orange' },
  ] as const

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>{t('dashboard.eyebrow')}</span>
          <Typography.Title level={1}>{t('dashboard.title')}</Typography.Title>
          <Typography.Paragraph>
            {t('dashboard.description')}
          </Typography.Paragraph>
          <Button
            type="primary"
            size="large"
            onClick={() => void navigate(ROUTES.settings)}
          >
            {t('dashboard.preferences')}
          </Button>
        </div>
        <div className={styles.art} aria-hidden="true">
          <span className={styles.artSheet}>
            <PencilRuler size={62} strokeWidth={1.4} />
          </span>
          <span className={styles.artSpark}>
            <Sparkles size={30} />
          </span>
          <span className={styles.artDot} />
        </div>
      </section>
      <section className={styles.highlights} aria-label={t('app.tagline')}>
        {highlights.map(({ key, icon: Icon, color }) => (
          <Card key={key} className={styles.highlight}>
            <span className={`${styles.icon} ${styles[color]}`}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <Typography.Title level={3}>
              {t(`dashboard.${key}Title`)}
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              {t(`dashboard.${key}Description`)}
            </Typography.Paragraph>
          </Card>
        ))}
      </section>
      <section>
        <Typography.Title level={2}>{t('dashboard.rooms')}</Typography.Title>
        <Card className={styles.rooms}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div className={styles.emptyText}>
                <Typography.Title level={4}>
                  {t('dashboard.emptyTitle')}
                </Typography.Title>
                <Typography.Paragraph type="secondary">
                  {t('dashboard.emptyDescription')}
                </Typography.Paragraph>
              </div>
            }
          />
        </Card>
      </section>
    </div>
  )
}
