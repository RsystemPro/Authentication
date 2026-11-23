import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { credentials } from '@/test/auth'
import { createAppStore } from '@/app/store'
import { createI18n } from '@/shared/i18n/i18n'
import { routes } from './routes'

describe('starter routes', () => {
  beforeEach(() =>
    server.use(
      http.post('http://localhost/api/auth/refresh', () =>
        HttpResponse.json(credentials()),
      ),
    ),
  )
  it('loads the workspace and navigates to settings', async () => {
    const router = createMemoryRouter(routes)
    render(
      <Provider store={createAppStore()}>
        <I18nextProvider i18n={createI18n('en')}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </Provider>,
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Good ideas start together.',
      }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }))
    expect(
      await screen.findByRole('heading', { name: 'Make yourself at home' }),
    ).toBeInTheDocument()
  })

  it('offers a way home from an unknown URL', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/missing-page'],
    })
    render(
      <Provider store={createAppStore()}>
        <I18nextProvider i18n={createI18n('en')}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </Provider>,
    )
    expect(await screen.findByText('This page is not here')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to workspace' }),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Good ideas start together.',
      }),
    ).toBeInTheDocument()
  })
})
