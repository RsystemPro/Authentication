import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../auth.types.js';

export const PUBLIC_ROUTE = 'auth:public';
export const RATE_POLICY = 'auth:rate-policy';
export type RatePolicy = 'login' | 'register' | 'email' | 'refresh' | 'token';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const AuthRatePolicy = (policy: RatePolicy) => SetMetadata(RATE_POLICY, policy);

export const Principal = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().principal,
);
