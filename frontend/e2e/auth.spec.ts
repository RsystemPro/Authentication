import { expect, test } from '@playwright/test'
import { mockAuth } from './auth-fixture.js'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    localStorage.setItem(
      'viraboard.preferences.v1',
      JSON.stringify({ language: 'en', theme: 'light' }),
    ),
  )
})

test('redirects to login, signs in to the requested page, restores on reload, and signs out', async ({
  context,
  page,
}, testInfo) => {
  const calls = await mockAuth(context, { signedIn: false })
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login$/)
  // Switch language using the public auth control, independent of preference storage keys.
  if (
    await page.getByRole('button', { name: 'English', exact: true }).isVisible()
  )
    await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.screenshot({
    path: testInfo.outputPath('login.png'),
    fullPage: true,
  })
  await page.getByLabel('Email', { exact: true }).fill('PERSON@example.com')
  await page
    .getByLabel('Password', { exact: true })
    .fill('a distinctive long passphrase')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(
    page.getByText('person@example.com', { exact: true }).last(),
  ).toBeVisible()
  await expect(page.getByText('This device', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('account.png'),
    fullPage: true,
  })
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Account & security' }),
  ).toBeVisible()
  await expect(page.getByText('This device', { exact: true })).toBeVisible()
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  )
  expect(stored).not.toContain('accessToken')
  expect(stored).not.toContain('passphrase')
  expect(calls.login).toBe(1)
  expect(calls.csrf.every((value) => value === '1')).toBe(true)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('verification and reset tokens leave history and require explicit submission', async ({
  context,
  page,
}) => {
  const calls = await mockAuth(context, { signedIn: false, verified: false })
  const token = 'a'.repeat(43)
  await page.goto(`/verify-email#token=${token}`)
  await expect(page).toHaveURL(/\/verify-email$/)
  expect(calls.verify).toBe(0)
  if (
    await page.getByRole('button', { name: 'English', exact: true }).isVisible()
  )
    await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page.getByText('Done.', { exact: false })).toBeVisible()
  expect(calls.verify).toBe(1)
  await page.goto(`/reset-password#token=${token}`)
  await expect(page).toHaveURL(/\/reset-password$/)
  expect(calls.reset).toBe(0)
  await page
    .getByLabel('New password', { exact: true })
    .fill('a distinctive new passphrase')
  await page
    .getByLabel('Confirm password', { exact: true })
    .fill('a distinctive new passphrase')
  await page
    .getByRole('button', { name: 'Reset password', exact: true })
    .click()
  await expect(page.getByText('Done.', { exact: false })).toBeVisible()
  expect(calls.reset).toBe(1)
})

test('tabs share a rotated session and logout, using real browser coordination', async ({
  context,
  page,
}) => {
  const calls = await mockAuth(context)
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const second = await context.newPage()
  await second.goto('/account')
  await expect(second.getByRole('heading', { level: 1 })).toBeVisible()
  expect(calls.refresh).toBe(1)
  const english = page.getByRole('button', { name: 'Sign out', exact: true })
  const persian = page.getByRole('button', { name: 'خروج', exact: true })
  if (await english.isVisible()) await english.click()
  else await persian.click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(second).toHaveURL(/\/login$/)
})
