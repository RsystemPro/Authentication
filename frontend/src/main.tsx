import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from '@/app/providers/app-provider'
import { AppRouter } from '@/app/router'
import 'antd/dist/reset.css'
import '@/styles/global.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The root element was not found.')

createRoot(rootElement).render(
  <StrictMode>
    <AppProvider>
      <AppRouter />
    </AppProvider>
  </StrictMode>,
)
