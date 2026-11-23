import { z } from 'zod'
import {
  credentialsSchema,
  type Credentials,
} from '@/features/auth/types/auth.types'
import { env } from '@/shared/config/env'
import { coordinationUnavailable } from './errors'
import type { AuthResult } from './types'

const coordinationName = `viraboard-auth:${env.VITE_API_BASE_URL}`
const sharedCredentialsSchema = credentialsSchema.extend({
  expiresAt: z.number(),
})
const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('credentials'),
    credentials: sharedCredentialsSchema,
  }),
  z.object({ type: z.literal('logout') }),
  z.object({ type: z.literal('request'), id: z.string() }),
  z.object({
    type: z.literal('snapshot'),
    id: z.string(),
    credentials: sharedCredentialsSchema,
  }),
])

interface TabCallbacks {
  getUsableCredentials: () => Credentials | null
  onCredentials: (credentials: Credentials) => void
  onLogout: () => void
}

export class AuthTabs {
  private readonly callbacks: TabCallbacks
  private channel?: BroadcastChannel
  private queue: Promise<unknown> = Promise.resolve()
  private pendingSnapshot?: { id: string; resolve: () => void }

  constructor(callbacks: TabCallbacks) {
    this.callbacks = callbacks
  }

  connect() {
    if (this.channel || typeof BroadcastChannel === 'undefined') return
    try {
      this.channel = new BroadcastChannel(coordinationName)
    } catch {
      return
    }
    this.channel.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = messageSchema.safeParse(event.data)
      if (!parsed.success) return

      const message = parsed.data
      switch (message.type) {
        case 'request': {
          const credentials = this.callbacks.getUsableCredentials()
          if (credentials)
            this.channel?.postMessage({
              type: 'snapshot',
              id: message.id,
              credentials,
            })
          break
        }
        case 'snapshot':
          if (message.id === this.pendingSnapshot?.id) {
            this.callbacks.onCredentials(message.credentials)
            this.pendingSnapshot.resolve()
          }
          break
        case 'credentials':
          this.callbacks.onCredentials(message.credentials)
          break
        case 'logout':
          this.callbacks.onLogout()
          break
      }
    }
  }

  disconnect() {
    this.channel?.close()
    this.channel = undefined
  }

  shareCredentials(credentials: Credentials) {
    // Only access credentials are shared. Refresh cookies remain HttpOnly.
    this.channel?.postMessage({ type: 'credentials', credentials })
  }

  shareLogout() {
    this.channel?.postMessage({ type: 'logout' })
  }

  async requestCredentials() {
    await new Promise<void>((resolve) => {
      const id = crypto.randomUUID()
      const timer = setTimeout(() => {
        this.pendingSnapshot = undefined
        resolve()
      }, 500)

      this.pendingSnapshot = {
        id,
        resolve: () => {
          clearTimeout(timer)
          this.pendingSnapshot = undefined
          resolve()
        },
      }
      this.channel?.postMessage({ type: 'request', id })
    })
  }

  runExclusively(work: () => Promise<AuthResult>): Promise<AuthResult> {
    // Cookie rotation must be serialized across tabs. Do not silently fall back
    // to uncoordinated requests when the required browser APIs are unavailable.
    if (!navigator.locks || !this.channel)
      return Promise.resolve(coordinationUnavailable())

    const next = this.queue
      .then(() => navigator.locks.request(coordinationName, work))
      .catch(coordinationUnavailable)
    this.queue = next.catch(() => undefined)
    return next
  }
}
