import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { authConfig } from '../config/auth.config.js';
import { appConfig } from '../config/app.config.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { RedisModule } from '../common/redis/redis.module.js';
import { AUTH_MAILER, SmtpAuthMailer } from './auth-mail.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { AuthCsrfGuard } from './guards/auth-csrf.guard.js';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    ConfigModule.forFeature(appConfig),
    PrismaModule,
    RedisModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    TokenService,
    AuthCsrfGuard,
    AuthRateLimitGuard,
    { provide: AUTH_MAILER, useClass: SmtpAuthMailer },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, SessionService, TokenService, PasswordService],
})
export class AuthModule { }
