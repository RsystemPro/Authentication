# ViraBoard frontend

A React frontend using Ant Design, Redux Toolkit/RTK Query, and the ViraBoard backend REST authentication contract.

## Run

Use Node.js 22.12+ (Node.js 24 LTS recommended) and pnpm 12.14.0.

```powershell
cd E:\Coding\Projects\New_ViraBoard\frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev
```

Start the backend on port 3000, then open http://localhost:5173. `/login` is public; `/`, `/settings`, and `/account` require a session. Unknown paths show a 404 after signing in.

## Included

- React 19, TypeScript with strict checking, Vite, and lazy routes.
- Ant Design 6 with `ConfigProvider` and `App` contexts, plus Lucide icons.
- Redux Toolkit with typed hooks and persisted browser preferences.
- RTK Query with request timeouts, caching, and refetch on focus/reconnect.
- i18next/react-i18next, Persian by default, English, automatic RTL/LTR, and matching Ant Design/Day.js locales.
- Light, dark, and system themes. System mode follows device changes. Blocked or corrupted local storage falls back safely.
- Zod for runtime configuration/preference validation.
- CSS Modules, semantic theme variables, responsive layouts, focus styles, a skip link, and reduced-motion support.
- Route loading states, an application error boundary, a route error fallback, and a 404 page.
- ESLint, Prettier, Vitest, React Testing Library, MSW, and Playwright.

## Structure

```text
src/
  app/             # Providers, router, Redux store, typed hooks
  features/        # Auth, dashboard, preferences, not-found page
  layouts/         # Shared application shell
  services/api/    # One RTK Query API base
  shared/          # Config, constants, i18n, theme, reusable UI
  styles/          # Global styles and theme variables
  test/            # Test setup and MSW server
e2e/               # Browser smoke tests
```

Keep each feature's files in folders by responsibility: `api/` for endpoints, `types/` for contracts, `store/` for Redux slices, `components/` for feature UI, `utils/` for helpers, `i18n/` for translations, and `pages/` for route pages and their styles. Create only folders the feature needs, and colocate tests with the related code. Put reusable frontend code in `src/shared`; put contracts needed by both frontend and backend in the project's root `shared/` folder when an actual shared contract exists.

## Connect the backend

The default `VITE_API_BASE_URL=/api` works with Vite's development proxy: `/api/auth/*` forwards to `http://localhost:3000/auth/*`. The proxy preserves browser Origin for CSRF validation. Backend `CORS_ORIGINS` and `AUTH_FRONTEND_URL` should include/match `http://localhost:5173`. Local HTTP uses the backend's non-secure development cookie. Configure backend SMTP to deliver verification/reset emails; registration does not automatically sign in.

For another API root, copy `.env.example` to `.env.local`, change `VITE_API_BASE_URL`, and restart Vite. Absolute API URLs need credentialed backend CORS. In production, serve over HTTPS and proxy `/api` to the backend, stripping that prefix and preserving Origin. Configure production cookie/origin settings on the backend before deployment. Vite preview does not provide the development API proxy.

`VITE_*` variables are included in the browser bundle; never store secrets there.

Add endpoints with `baseApi.injectEndpoints()` in the relevant feature. Export generated hooks from that module. Keep server state in RTK Query and UI state in feature slices. Define tag types and invalidation as real resources are introduced. Use `AntApp.useApp()` for messages/modals that need the active theme and locale.

On startup, one coordinated refresh restores a session from the HttpOnly cookie. Access tokens stay in Redux memory; neither tokens nor passwords are saved to local/session storage. Redux DevTools is disabled because auth requests carry credentials. Auth mutations release their cached arguments after completion. Protected requests attach Bearer credentials, refresh before expiry or once after 401, then retry once. Public endpoints opt out of reauthentication; write requests include `X-CSRF-Protection: 1` and cookies.

Web Locks and BroadcastChannel coordinate auth commands and refreshes across same-origin tabs. After locking, a peer snapshot is requested and credentials are rechecked before rotating again. Unsupported browsers/insecure origins show a clear error instead of running uncoordinated refreshes. Use one frontend origin for the application; different origins cannot share a browser lock. Logout clears private API data and notifies tabs only after server success. A failed server logout keeps the session visible with a retry message. Temporary failures keep existing credentials; they do not trigger automatic retry loops.

Public routes: `/login`, `/register`, `/forgot-password`, `/resend-verification`, `/verify-email`, `/reset-password`. Backend email links use `#token=...`: the router captures the fragment into memory and removes it from history before initialization. Verification/reset require explicit submission. Reloading after capture requires reopening the email link. Password change/reset revokes sessions and requires fresh login. `/account` displays the current user, password controls, and cursor-paginated sessions with revocation and sign-out-all actions. JWT session IDs only label this device; the backend authorizes every protected request.

The frontend does not yet implement rooms, a whiteboard, sockets, or media.

## Validate

```powershell
pnpm.cmd check
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

`check` runs formatting, linting, project-wide TypeScript checking, Vitest tests, and the production build. MSW tests cover auth headers, refresh concurrency, cross-tab restoration/logout, session revocation, transient failures, cache cleanup, preferences, and routing. Playwright tests use a mocked backend contract with rotating HttpOnly cookies and real browser coordination, on desktop/mobile. They cover login, return routes, reload, logout, email-link confirmation, and existing preference/layout behavior. They do not prove real SMTP, database/Redis, production CORS, or deployed cookie behavior.

Individual commands: `lint`, `typecheck`, `test`, `test:watch`, `format`, `format:check`, `build`, `preview`, `test:e2e`. Run `build` before `test:e2e` so browser checks use current code.

If browser downloads are unavailable, use an installed Chromium-based browser. For example, with Microsoft Edge on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
pnpm.cmd test:e2e
```

## Deploy

`pnpm.cmd build` writes `dist/`. Serve that directory over HTTPS. Configure the web server to serve `index.html` for frontend routes such as `/settings`, while forwarding API paths to the backend. `pnpm.cmd preview` is for local build verification.

Future classroom, Excalidraw, PDF, and media dependencies should be added with their features and loaded only on the routes that use them. Keep high-frequency pointer/media data out of the global Redux store.

Reference documentation: [RTK Query reauthentication](https://redux-toolkit.js.org/rtk-query/usage/customizing-queries), [Ant Design Form](https://ant.design/components/form/), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), and the backend's `docs/AUTH_API.md`.
