Set up the dedicated local PostgreSQL database and Redis first. Authentication uses
Prisma sessions, short-lived JWTs, rotating opaque refresh cookies, email verification,
password recovery and distributed rate limits.

See [AUTH_ARCHITECTURE.md](docs/AUTH_ARCHITECTURE.md) for the security design and
[AUTH_API.md](docs/AUTH_API.md) for endpoints and frontend integration.

```powershell
# Install, copy .env.example to .env, and configure your local services.
pnpm.cmd install
# Generate a signing key and put it in AUTH_JWT_SECRET; do not commit it.
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
# Ensure DATABASE_URL_SB points to this application's database, not another project.
# Environment variables take precedence over .env; clear an incompatible inherited
# DATABASE_URL_SB in this shell before using the .env value.
pnpm.cmd exec prisma migrate status
pnpm.cmd prisma:migrate
pnpm.cmd start:dev
```

Registration/recovery require a configured SMTP transport to deliver usable links.
Development without SMTP logs only that delivery is unavailable; no tokens or links
are printed. Production refuses missing SMTP, insecure cookie settings, non-HTTPS
public origins, disabled compromised-password screening, or an invalid signing key.
Verification/reset frontend pages must explicitly POST their fragment token.

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
pnpm.cmd auth:benchmark

# Use a dedicated local database named viraboard_auth_test (optional _suffix).
# Integration/e2e helpers refuse other database names and remote hosts.
$env:AUTH_TEST_DATABASE_URL_SB = '<your local PostgreSQL test connection URL>'
$env:DATABASE_URL_SB = $env:AUTH_TEST_DATABASE_URL_SB
pnpm.cmd exec prisma migrate deploy
pnpm.cmd test:integration
pnpm.cmd test:e2e
```

Tests use real PostgreSQL and Redis, isolated row/key prefixes, fake outbound email,
and synthetic credentials. Tests never send real authentication email or query HIBP
with real user passwords. Unit tests exercise HIBP privacy/failure handling with
mocked responses. Keep the test database separate from development and production.

Deployment requires HTTPS, explicit client/proxy allowlists, coordinated secrets,
SMTP delivery monitoring and an Argon2 benchmark on the deployment host. Cookie tests
use HTTP request assertions; validate real-browser behavior in the intended topology.
