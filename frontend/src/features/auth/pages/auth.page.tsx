import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { Shapes } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/app/store/hooks'
import { setLanguage } from '@/features/preferences/store/preferences.slice'
import { authErrorKey } from '@/services/api/auth-client'
import { emailToken, forgetEmailToken } from '../utils/email-token'
import {
  useForgotPasswordMutation,
  useLoginMutation,
  useRegisterMutation,
  useResendVerificationMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
} from '../api/auth.api'
import styles from './auth.page.module.css'

const modes = [
  'login',
  'register',
  'forgot-password',
  'resend-verification',
  'verify-email',
  'reset-password',
] as const
type Mode = (typeof modes)[number]
interface Values {
  email: string
  password: string
  confirmPassword: string
}

export function Component() {
  const location = useLocation()
  const mode =
    modes.find((value) => `/${value}` === location.pathname) ?? 'login'
  return <AuthForm key={mode} mode={mode} />
}
function AuthForm({ mode }: { mode: Mode }) {
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const [form] = Form.useForm<Values>()
  const [token] = useState(() => emailToken(location.pathname))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState(false)
  const [login, loginState] = useLoginMutation()
  const [register, registerState] = useRegisterMutation()
  const [forgot, forgotState] = useForgotPasswordMutation()
  const [resend, resendState] = useResendVerificationMutation()
  const [verify, verifyState] = useVerifyEmailMutation()
  const [reset, resetState] = useResetPasswordMutation()
  const tokenMode = mode === 'verify-email' || mode === 'reset-password'
  const passwordMode =
    mode === 'login' || mode === 'register' || mode === 'reset-password'
  const newPassword = mode === 'register' || mode === 'reset-password'

  async function submit(values: Values) {
    if (busy) return
    setBusy(true)
    setError(undefined)
    const email = values.email?.trim().toLowerCase()
    try {
      if (mode === 'login') {
        await login({ email, password: values.password }).unwrap()
        const state = location.state as { from?: unknown } | null
        const from =
          typeof state?.from === 'string' &&
          state.from.startsWith('/') &&
          !state.from.startsWith('//') &&
          !state.from.includes('\\')
            ? state.from
            : '/'
        await navigate(from, { replace: true })
      } else if (mode === 'register')
        await register({ email, password: values.password }).unwrap()
      else if (mode === 'forgot-password') await forgot({ email }).unwrap()
      else if (mode === 'resend-verification') await resend({ email }).unwrap()
      else if (mode === 'verify-email') await verify({ token }).unwrap()
      else await reset({ token, newPassword: values.password }).unwrap()
      if (tokenMode) forgetEmailToken()
      setSuccess(true)
      form.resetFields()
    } catch (reason) {
      setError(authErrorKey(reason))
    } finally {
      // RTK Query mutation arguments include secrets; release them after completion.
      loginState.reset()
      registerState.reset()
      forgotState.reset()
      resendState.reset()
      verifyState.reset()
      resetState.reset()
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.language}>
          <Button
            size="small"
            onClick={() =>
              dispatch(setLanguage(i18n.language === 'fa' ? 'en' : 'fa'))
            }
          >
            {i18n.language === 'fa' ? 'English' : 'فارسی'}
          </Button>
        </div>
        <Link to="/" className={styles.brand}>
          <Shapes aria-hidden="true" />
          {t('app.name')}
        </Link>
        <Typography.Title level={1}>
          {t(`auth.titles.${mode}`)}
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          {t(tokenMode ? 'auth.confirmAction' : 'auth.introduction')}
        </Typography.Paragraph>
        {error && (
          <Alert
            className={styles.notice}
            role="alert"
            type="error"
            showIcon
            title={t(`auth.errors.${error}`)}
          />
        )}
        {success ? (
          <Alert
            type="success"
            showIcon
            title={t(tokenMode ? 'auth.actionComplete' : 'auth.emailSent')}
          />
        ) : tokenMode && !/^[A-Za-z0-9_-]{43}$/.test(token) ? (
          <Alert role="alert" type="error" title={t('auth.invalidLink')} />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => void submit(values)}
            disabled={busy}
            requiredMark={false}
          >
            {!tokenMode && (
              <Form.Item
                name="email"
                label={t('auth.email')}
                rules={[
                  {
                    required: true,
                    type: 'email',
                    max: 254,
                    transform: (value: string) => value?.trim(),
                    message: t('auth.emailRule'),
                  },
                ]}
              >
                <Input
                  type="email"
                  autoComplete="email"
                  dir="ltr"
                  maxLength={254}
                />
              </Form.Item>
            )}
            {passwordMode && (
              <Form.Item
                name="password"
                label={t(newPassword ? 'auth.newPassword' : 'auth.password')}
                rules={[
                  {
                    required: true,
                    min: newPassword ? 15 : 1,
                    max: 128,
                    message: t(
                      newPassword
                        ? 'auth.passwordRule'
                        : 'auth.passwordRequired',
                    ),
                  },
                ]}
                extra={newPassword ? t('auth.passwordHint') : undefined}
              >
                <Input.Password
                  autoComplete={
                    newPassword ? 'new-password' : 'current-password'
                  }
                  dir="ltr"
                  maxLength={128}
                />
              </Form.Item>
            )}
            {newPassword && (
              <Form.Item
                name="confirmPassword"
                label={t('auth.confirmPassword')}
                dependencies={['password']}
                rules={[
                  { required: true, message: t('auth.passwordRequired') },
                  ({ getFieldValue }) => ({
                    validator: (_, value: string) =>
                      value === getFieldValue('password')
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
            )}
            <Button type="primary" htmlType="submit" block loading={busy}>
              {t(`auth.titles.${mode}`)}
            </Button>
          </Form>
        )}
        <nav className={styles.links} aria-label={t('auth.navigation')}>
          {(
            [
              'login',
              'register',
              'forgot-password',
              'resend-verification',
            ] as const
          )
            .filter(
              (value) => value !== mode && (!success || value !== 'register'),
            )
            .map((value) => (
              <Link key={value} to={`/${value}`}>
                {t(`auth.titles.${value}`)}
              </Link>
            ))}
        </nav>
      </Card>
    </main>
  )
}
