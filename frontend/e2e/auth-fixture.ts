import type { BrowserContext } from '@playwright/test'
const user = {
  id: '2f613c44-2099-4209-9f99-5fce4670bf95',
  email: 'person@example.com',
  emailVerifiedAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
}
const currentSessionId = '1ec31834-f874-4d88-8ea2-6de9efab1777'
const credentials = (version = 'fresh') => ({
  accessToken: `header.${Buffer.from(JSON.stringify({ sid: currentSessionId })).toString('base64url')}.${version}`,
  expiresIn: 600,
  user,
})

export async function mockAuth(
  context: BrowserContext,
  options: { signedIn?: boolean; verified?: boolean } = {},
) {
  let signedIn = options.signedIn ?? true
  let verified = options.verified ?? true
  let cookie = 0
  let accessToken = credentials('0').accessToken
  const calls = {
    refresh: 0,
    login: 0,
    verify: 0,
    reset: 0,
    csrf: [] as (string | undefined)[],
  }
  if (signedIn)
    await context.addCookies([
      {
        name: 'refresh_dev',
        value: '0',
        url: 'http://127.0.0.1:4178',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
  await context.route('**/api/auth/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/auth/', '')
    const headers = request.headers()
    if (request.method() !== 'GET')
      calls.csrf.push(headers['x-csrf-protection'])
    const json = (
      data: unknown,
      status = 200,
      extra: Record<string, string> = {},
    ) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store', ...extra },
        body: JSON.stringify(data),
      })
    const issue = () => {
      cookie++
      accessToken = credentials(String(cookie)).accessToken
      return json({ ...credentials(), accessToken }, 200, {
        'Set-Cookie': `refresh_dev=${cookie}; Path=/; HttpOnly; SameSite=Lax`,
      })
    }
    if (path === 'refresh') {
      calls.refresh++
      if (
        !signedIn ||
        !headers.cookie?.split('; ').includes(`refresh_dev=${cookie}`)
      ) {
        signedIn = false
        return json({}, 401)
      }
      return issue()
    }
    if (path === 'login') {
      calls.login++
      if (!verified) return json({ message: 'Invalid email or password' }, 401)
      signedIn = true
      return issue()
    }
    if (['register', 'resend-verification', 'forgot-password'].includes(path))
      return json(
        { message: 'If this address is eligible, instructions will be sent.' },
        202,
      )
    if (path === 'verify-email') {
      calls.verify++
      verified = true
      return route.fulfill({ status: 204 })
    }
    if (path === 'reset-password') {
      calls.reset++
      signedIn = false
      return route.fulfill({ status: 204 })
    }
    if (
      path === 'logout' ||
      path === 'logout-all' ||
      path === 'change-password' ||
      request.method() === 'DELETE'
    ) {
      signedIn = false
      return route.fulfill({
        status: 204,
        headers: {
          'Set-Cookie':
            'refresh_dev=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
        },
      })
    }
    if (!signedIn || headers.authorization !== `Bearer ${accessToken}`)
      return json({}, 401)
    if (path === 'me') return json(user)
    if (path.startsWith('sessions'))
      return json({
        items: [
          {
            id: currentSessionId,
            userAgent: 'Playwright browser',
            ipAddress: '127.0.0.1',
            createdAt: user.createdAt,
            lastUsedAt: user.createdAt,
            idleExpiresAt: '2026-11-15T00:00:00Z',
            absoluteExpiresAt: '2026-12-01T00:00:00Z',
          },
        ],
        nextCursor: null,
      })
    return json({}, 404)
  })
  return calls
}
