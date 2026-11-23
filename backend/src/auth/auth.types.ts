import type { Request } from 'express';
import type { Prisma, User } from '../generated/prisma/client.js';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  email: string;
}

export type AuthRequest = Request & { principal?: AuthPrincipal };
export type AuthTransaction = Prisma.TransactionClient;
export type PublicUser = Pick<
  User,
  'id' | 'email' | 'emailVerifiedAt' | 'createdAt'
>;
export const publicUserSelect = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

export const publicUser = (user: PublicUser): PublicUser => ({
  id: user.id,
  email: user.email,
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
});

export interface DeviceMetadata {
  userAgent?: string;
  ipAddress?: string;
}
export const sanitizeMetadata = (
  value: string | undefined,
  length: number,
): string | undefined =>
  // Control characters cannot be allowed in stored device labels or audit context.
  // eslint-disable-next-line no-control-regex
  value?.replace(/[\x00-\x1f\x7f]/g, '').slice(0, length) || undefined;
