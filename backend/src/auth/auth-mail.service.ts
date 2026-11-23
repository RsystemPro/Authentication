import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { authConfig } from '../config/auth.config.js';

export const AUTH_MAILER = Symbol('AUTH_MAILER');
export interface AuthMail {
  to: string;
  kind: 'verify' | 'reset' | 'password-changed';
  token?: string;
}
export interface AuthMailer {
  send(message: AuthMail): Promise<void>;
}

@Injectable()
export class SmtpAuthMailer implements AuthMailer {
  private readonly logger = new Logger(SmtpAuthMailer.name);
  constructor(
    @Inject(authConfig.KEY) private readonly config: ConfigType<typeof authConfig>,
  ) { }

  async send(message: AuthMail): Promise<void> {

    //initialize
    if (!this.config.smtpUrl) {
      this.logger.warn('Authentication email transport is not configured');
      return;
    }
    const url = new URL(this.config.smtpUrl);
    const transport = nodemailer.createTransport({
      host: url.hostname,
      port: Number(url.port || (url.protocol === 'smtps:' ? 465 : 587)),
      secure: url.protocol === 'smtps:',
      requireTLS: process.env.NODE_ENV === 'production',
      auth: url.username
        ? {
          user: decodeURIComponent(url.username),
          pass: decodeURIComponent(url.password),
        }
        : undefined,
      connectionTimeout: 5000,
      socketTimeout: 10000,
      tls: { minVersion: 'TLSv1.2' },
      logger: false,
      debug: false,
    });

    //send mail
    const action = message.kind === 'verify' ? 'verify-email' : 'reset-password';
    const text = message.kind === 'password-changed' ? 'Your ViraBoard password changed and all sessions were revoked. Contact support if this was not you.' : `Open ${this.config.frontendUrl}/${action}#token=${encodeURIComponent(message.token!)} and explicitly confirm the action. If you did not request this, ignore this email.`;
    try {
      await transport.sendMail({
        from: this.config.mailFrom,
        to: message.to,
        subject:
          message.kind === 'verify'
            ? 'Verify your ViraBoard email'
            : message.kind === 'reset'
              ? 'Reset your ViraBoard password'
              : 'ViraBoard password changed',
        text,
      });
    } finally {
      transport.close();
    }
  }
}
