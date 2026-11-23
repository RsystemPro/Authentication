import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request } from 'express';
import { appConfig } from '../../config/app.config.js';
import { authConfig } from '../../config/auth.config.js';

@Injectable()
export class AuthCsrfGuard implements CanActivate {

  constructor(
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
    @Inject(authConfig.KEY) private readonly auth: ConfigType<typeof authConfig>,
  ) { }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.headers.origin;
    const site = request.headers['sec-fetch-site'];
    if (
      !origin ||
      !this.app.corsOrigins.includes(origin) ||
      request.headers['x-csrf-protection'] !== '1' ||
      request.headers['sec-fetch-mode'] === 'navigate' ||
      (site === 'cross-site' && this.auth.sameSite !== 'none')
    ) {
      throw new ForbiddenException('Untrusted request origin');
    }
    return true;
  }

}
