import { z } from 'zod'

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  emailVerifiedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const credentialsSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().positive(),
  user: userSchema,
})

export type User = z.infer<typeof userSchema>
export type Credentials = z.infer<typeof credentialsSchema> & {
  expiresAt: number
}
export interface LoginInput {
  email: string
  password: string
}
export interface Session {
  id: string
  createdAt: string
  lastUsedAt: string
  idleExpiresAt: string
  absoluteExpiresAt: string
  userAgent: string | null
  ipAddress: string | null
}

// Used only to label the current device, never to authorize a request.
export function sessionId(token?: string) {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return undefined
    const parsed: unknown = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    )
    return z.object({ sid: z.string() }).parse(parsed).sid
  } catch {
    return undefined
  }
}
