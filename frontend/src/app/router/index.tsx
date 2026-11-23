import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './routes'
import { captureEmailToken } from '@/features/auth/utils/email-token'

captureEmailToken()
const router = createBrowserRouter(routes)

export function AppRouter() {
  return <RouterProvider router={router} />
}
