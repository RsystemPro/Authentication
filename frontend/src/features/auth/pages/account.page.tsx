import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppSelector } from '@/app/store/hooks'
import { authErrorKey } from '@/services/api/auth-client'
import { sessionId } from '../types/auth.types'
import {
  useChangePasswordMutation,
  useLogoutAllMutation,
  useMeQuery,
  useRevokeSessionMutation,
  useSessionsQuery,
} from '../api/auth.api'
import styles from './account.module.css'

export function Component() {
  const { t, i18n } = useTranslation()
  const [form] = Form.useForm<{
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }>()
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const token = useAppSelector((state) => state.auth.credentials?.accessToken)
  const current = sessionId(token)
  const me = useMeQuery()
  const sessions = useSessionsQuery(cursors.at(-1))
  const [revoke, revokeState] = useRevokeSessionMutation()
  const [logoutAll, logoutState] = useLogoutAllMutation()
  const [changePassword, passwordState] = useChangePasswordMutation()
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
    } catch (reason) {
      setError(authErrorKey(reason))
    } finally {
      revokeState.reset()
      logoutState.reset()
      passwordState.reset()
      setBusy(false)
    }
  }
  return (
    <section className={styles.page}>
      <Typography.Title level={1}>{t('auth.account')}</Typography.Title>
      {error && (
        <Alert
          role="alert"
          type="error"
          showIcon
          title={t(`auth.errors.${error}`)}
        />
      )}
      <Card title={t('auth.profile')} loading={me.isLoading}>
        {me.error ? (
          <Alert
            type="error"
            title={t(`auth.errors.${authErrorKey(me.error)}`)}
            action={
              <Button onClick={() => void me.refetch()}>
                {t('auth.retry')}
              </Button>
            }
          />
        ) : (
          <Typography.Text dir="ltr">{me.data?.email}</Typography.Text>
        )}
      </Card>
      <Card title={t('auth.changePassword')}>
        <Typography.Paragraph type="secondary">
          {t('auth.passwordChangeHint')}
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          disabled={busy}
          onFinish={({ currentPassword, newPassword }) =>
            void run(async () => {
              await changePassword({ currentPassword, newPassword }).unwrap()
              form.resetFields()
            })
          }
          requiredMark={false}
        >
          <Form.Item
            name="currentPassword"
            label={t('auth.password')}
            rules={[
              { required: true, max: 128, message: t('auth.passwordRequired') },
            ]}
          >
            <Input.Password
              autoComplete="current-password"
              dir="ltr"
              maxLength={128}
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t('auth.newPassword')}
            rules={[
              {
                required: true,
                min: 15,
                max: 128,
                message: t('auth.passwordRule'),
              },
            ]}
            extra={t('auth.passwordHint')}
          >
            <Input.Password
              autoComplete="new-password"
              dir="ltr"
              maxLength={128}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('auth.confirmPassword')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('auth.passwordRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value: string) =>
                  value === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('auth.passwordMismatch'))),
              }),
            ]}
          >
            <Input.Password
              autoComplete="new-password"
              dir="ltr"
              maxLength={128}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy}>
            {t('auth.changePassword')}
          </Button>
        </Form>
      </Card>
      <Card
        title={t('auth.sessions')}
        extra={
          <Button
            onClick={() => void sessions.refetch()}
            disabled={sessions.isFetching}
          >
            {t('auth.refresh')}
          </Button>
        }
      >
        {sessions.error && (
          <Alert
            role="alert"
            type="error"
            title={t(`auth.errors.${authErrorKey(sessions.error)}`)}
          />
        )}
        {sessions.isLoading && (
          <Typography.Text>{t('common.loading')}</Typography.Text>
        )}
        {sessions.currentData?.items.map((session) => (
          <div key={session.id} className={styles.session}>
            <div className={styles.device}>
              <Typography.Text strong>
                {session.userAgent || t('auth.unknownDevice')}
              </Typography.Text>
              {session.id === current && (
                <Tag color="green">{t('auth.currentDevice')}</Tag>
              )}
              <Typography.Text type="secondary" dir="ltr">
                {session.ipAddress || '—'}
              </Typography.Text>
              <Typography.Text type="secondary">
                {t('auth.lastActive')}:{' '}
                {new Date(session.lastUsedAt).toLocaleString(i18n.language)}
              </Typography.Text>
            </div>
            <Popconfirm
              title={t('auth.revokeConfirm')}
              onConfirm={() => run(() => revoke(session.id).unwrap())}
            >
              <Button danger disabled={busy}>
                {t('auth.revoke')}
              </Button>
            </Popconfirm>
          </div>
        ))}
        {sessions.currentData?.items.length === 0 && (
          <Typography.Paragraph>{t('auth.noSessions')}</Typography.Paragraph>
        )}
        <Space wrap className={styles.actions}>
          <Button
            disabled={cursors.length === 1 || sessions.isFetching}
            onClick={() => setCursors((values) => values.slice(0, -1))}
          >
            {t('auth.previous')}
          </Button>
          <Button
            disabled={!sessions.currentData?.nextCursor || sessions.isFetching}
            onClick={() =>
              setCursors((values) => [
                ...values,
                sessions.currentData?.nextCursor ?? undefined,
              ])
            }
          >
            {t('auth.next')}
          </Button>
          <Popconfirm
            title={t('auth.logoutAllConfirm')}
            onConfirm={() => run(() => logoutAll().unwrap())}
          >
            <Button danger disabled={busy}>
              {t('auth.logoutAll')}
            </Button>
          </Popconfirm>
        </Space>
      </Card>
    </section>
  )
}
