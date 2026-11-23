import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './server'
import { TestBroadcastChannel, testLocks } from './auth-browser'

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: testLocks,
})
Object.defineProperty(globalThis, 'BroadcastChannel', {
  configurable: true,
  writable: true,
  value: TestBroadcastChannel,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
  TestBroadcastChannel.channels.clear()
})
afterAll(() => server.close())
