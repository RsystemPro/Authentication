import type { RouteObject } from 'react-router-dom'
import { AppLayout } from '@/layouts/app-layout'
import { AppError } from '@/shared/ui/app-error'
import { ROUTES } from '@/shared/constants/routes'
import { PageLoader } from '@/shared/ui/page-loader'
import {
  AuthBoundary,
  GuestOnly,
  RequireAuth,
} from '@/features/auth/components/auth-boundary'

export const routes: RouteObject[] = [
  {
    element: <AuthBoundary />,
    errorElement: <AppError />,
    HydrateFallback: PageLoader,
    children: [
      {
        element: <GuestOnly />,
        children: [
          'login',
          'register',
          'forgot-password',
          'resend-verification',
        ].map((path) => ({
          path,
          lazy: () => import('@/features/auth/pages/auth.page'),
        })),
      },
      ...['verify-email', 'reset-password'].map((path) => ({
        path,
        lazy: () => import('@/features/auth/pages/auth.page'),
      })),
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                lazy: () => import('@/features/dashboard/pages/dashboard.page'),
              },
              {
                path: ROUTES.settings,
                lazy: () =>
                  import('@/features/preferences/pages/settings.page'),
              },
              {
                path: '/account',
                lazy: () => import('@/features/auth/pages/account.page'),
              },
              {
                path: '*',
                lazy: () => import('@/features/not-found/pages/not-found.page'),
              },
            ],
          },
        ],
      },
    ],
  },
]
