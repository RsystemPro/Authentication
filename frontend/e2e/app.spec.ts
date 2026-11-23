import { expect, test } from '@playwright/test'
import { mockAuth } from './auth-fixture.js'

test.beforeEach(async ({ context }) => {
  await mockAuth(context)
})

test('preferences survive reload, routes work, and mobile content fits', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'ایده‌های خوب',
  )
  await page.getByRole('link', { name: 'تنظیمات', exact: true }).click()
  await page.getByLabel('زبان', { exact: true }).click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await page.getByLabel('Theme', { exact: true }).click()
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goto('/not-a-page')
  await expect(page.getByText('This page is not here')).toBeVisible()
  await page.getByRole('button', { name: 'Back to workspace' }).click()
  await expect(
    page.getByRole('heading', { name: 'Good ideas start together.' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('workspace.png'),
    fullPage: true,
  })
})

test('system theme follows device changes until a theme is selected', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/settings')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('پوسته', { exact: true }).click()
  await page.getByRole('option', { name: 'تیره', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({
    path: testInfo.outputPath('settings.png'),
    fullPage: true,
  })
})
