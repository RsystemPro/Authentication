import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE } from '../decorators/auth.decorators.js';
import { SessionService } from '../session.service.js';
import { TokenService } from '../token.service.js';
import type { AuthRequest } from '../auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    if (context.getType() !== 'http')
      throw new UnauthorizedException('Authentication is required');
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(
      request.headers.authorization ?? '',
    );
    if (!match || match[1].length > 4096)
      throw new UnauthorizedException('Authentication is required');
    const claims = await this.tokens.verifyAccess(match[1]);
    request.principal = await this.sessions.validate(claims.sub, claims.sid);
    return true;
  }

}
