# Frontend

- React + TypeScript + Vite, with feature folders and lazy React Router pages.
- Group feature files by responsibility in `api`, `types`, `store`, `components`, `utils`, `i18n`, and `pages`; create folders only when needed and colocate tests with related code.
- Ant Design, Lucide icons, CSS Modules, Persian/English RTL/LTR, and light/dark/system themes.
- Redux Toolkit stores browser preferences and memory-only auth credentials; typed hooks are in `src/app/store/hooks.ts`.
- RTK Query owns server data. Inject protected endpoints into `src/services/api/base-api.ts`; explicitly mark public endpoints with `extraOptions: { public: true }`.
- Auth commands use a separate `authApi` cache so clearing private `baseApi` data cannot cancel sign-in or recovery.
- `features/auth` implements the backend REST auth flow, protected routes, email verification/recovery, and account/session controls. `services/api/auth-client.ts` coordinates refresh and logout with Web Locks/BroadcastChannel; modern browsers on HTTPS or localhost are required.
- Auth request flow is in `services/api/auth-client.ts`; `services/api/auth/` separates HTTP/cookies/headers (`request.ts`), in-memory credentials (`session.ts`), tab messages/locks (`tabs.ts`), errors, and request types.
- `VITE_API_BASE_URL` is public build configuration, validated with Zod. Default: `/api`.
- Vite proxies `/api` to `http://localhost:3000` in development. Preserve Origin; backend CORS/CSRF must allow `http://localhost:5173`. Production needs an equivalent proxy and HTTPS.
- `pnpm.cmd dev` starts development. `pnpm.cmd check` runs static checks, unit/integration tests, and production build.
- After building, `pnpm.cmd test:e2e` runs desktop/mobile Chromium smoke tests. See README for browser installation and deployment requirements.
