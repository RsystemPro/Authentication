# ViraBoard Authentication

A full-stack authentication project with a NestJS API and a React/TypeScript frontend. It provides account, sign-in, recovery, and session-management flows for the ViraBoard web app.

## Features

- Register, sign in, verify email, resend verification, and recover or change a password.
- View active sessions, revoke one session, or sign out everywhere.
- Protected dashboard, settings, and account pages; Persian and English UI with RTL/LTR layouts and light/dark themes.

## Security

- Passwords are hashed with Argon2id, with checks for known compromised passwords.
- Short-lived access tokens stay in frontend memory. Rotating refresh tokens use `HttpOnly` cookies and are stored as hashes by the backend.
- One-time email tokens expire and are consumed once. Origin/CSRF checks and Redis-backed rate limits protect authentication requests.
- Sessions can be revoked, and refresh-token reuse triggers session revocation. Production configuration requires HTTPS and secure cookies.

## Run locally

Requirements: Node.js 22.12+ and pnpm 12.14+, plus PostgreSQL and Redis. SMTP is needed to deliver verification and recovery emails.

### Backend

```powershell
cd backend
pnpm.cmd install
Copy-Item .env.example .env
```

Set `DATABASE_URL_SB`, Redis settings, and a random `AUTH_JWT_SECRET` in `backend/.env`. Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set `AUTH_FRONTEND_URL` and `CORS_ORIGINS` to the frontend origin, and configure `AUTH_SMTP_URL` if you want email flows to deliver messages.

```powershell
pnpm.cmd exec prisma migrate deploy
pnpm.cmd start:dev
```

### Frontend

In another terminal:

```powershell
cd frontend
pnpm.cmd install
Copy-Item .env.example .env.local
pnpm.cmd dev
```

Open <http://localhost:5173>. The default `VITE_API_BASE_URL=/api` uses the Vite proxy to reach the backend on port 3000.

## Configuration

Use each workspace's `.env.example` as a template. Keep secrets in the backend `.env`; `VITE_*` values are public and are included in the frontend bundle. For production, serve the frontend and API over HTTPS, configure the backend's allowed origins, secure cookies, database, Redis, and SMTP.
