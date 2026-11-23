-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'SESSION_CREATED', 'SESSION_REVOKED', 'REFRESH_REUSE', 'EMAIL_VERIFIED', 'RECOVERY_REQUEST', 'PASSWORD_CHANGED', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revocationReason" VARCHAR(64),
    "userAgent" VARCHAR(256),
    "ipAddress" VARCHAR(64),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthOneTimeToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AuthOneTimeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSecurityEvent" (
    "id" UUID NOT NULL,
    "type" "AuthEventType" NOT NULL,
    "userId" UUID,
    "sessionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_absoluteExpiresAt_idx" ON "AuthSession"("userId", "revokedAt", "absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_idleExpiresAt_idx" ON "AuthSession"("idleExpiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_absoluteExpiresAt_idx" ON "AuthSession"("absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_consumedAt_idx" ON "RefreshToken"("sessionId", "consumedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthOneTimeToken_tokenHash_key" ON "AuthOneTimeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthOneTimeToken_userId_purpose_consumedAt_idx" ON "AuthOneTimeToken"("userId", "purpose", "consumedAt");

-- CreateIndex
CREATE INDEX "AuthOneTimeToken_expiresAt_idx" ON "AuthOneTimeToken"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_userId_createdAt_idx" ON "AuthSecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_createdAt_idx" ON "AuthSecurityEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthOneTimeToken" ADD CONSTRAINT "AuthOneTimeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSecurityEvent" ADD CONSTRAINT "AuthSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSecurityEvent" ADD CONSTRAINT "AuthSecurityEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
