import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => {
        if (value.startsWith('/') && !value.startsWith('//')) return true
        try {
          return ['http:', 'https:'].includes(new URL(value).protocol)
        } catch {
          return false
        }
      },
      { message: 'Use a relative path starting with / or an HTTP(S) URL.' },
    )
    .default('/api'),
})

export const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
})
