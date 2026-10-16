# Development and deployment

For step-by-step local startup, Emulator sign-in and troubleshooting, see the [Thai localhost guide](localhost.md).

Use Node.js 22 (22.12 or later for the installed development tools), npm, and Java 21 for Firestore Emulator. Dependencies use the root npm workspace lockfile.

```bash
npm ci
npm run typecheck
npm run test:functions
npm run test:integration
npm run emulators
```

`test:integration` starts and stops Auth, Firestore and Functions Emulators under `demo-home-work`. Tests clear emulator data; do not run them alongside a development session using that same project/ports. The launcher uses `.tools/java21/Contents/Home/bin/java` when present, otherwise Java from PATH. Java was downloaded there for this workspace and is ignored by git; another machine needs its own Java 21 installation.

The integration suite invokes actual callable HTTP handlers and service transactions, then tests Firestore Rules. Scheduled cleanup is tested through its callable-independent job function; the scheduler itself needs verification after deployment.

`npm run build` builds shared first, bundles it and Zod into the Functions entry point, builds the web app, and generates `functions/deploy/` with only the external Firebase runtime dependencies. Firebase uses this generated folder as its source. It does not upload a dependency on the sibling shared workspace. The artifact pins Firebase dependencies to installed lockfile versions. `npm run package:functions` also generates the artifact's installation lockfile. Both build folders and generated deployment output are ignored by git.

Before production deployment, choose a separate real Firebase project, enable Google Authentication and App Check, configure Firestore in Singapore, and put the permitted HTTPS browser origins in `functions/.env`:

```text
APP_ORIGINS=https://your-app.web.app
```

Build packaging copies that ignored environment file into the deployment artifact. Production callables reject calls when origins are unconfigured and enforce valid App Check tokens. Emulator configuration is not production configuration. Avoid secrets in environment files; use Secret Manager for any future secrets.

The following is an operator command, not a command executed by this implementation:

```bash
npx firebase deploy --project YOUR_PRODUCTION_PROJECT --only functions,firestore
```

The predeploy step builds and packages automatically. Do not deploy to a `demo-` project; it exists only for Emulators. A production release also requires the backup/restore and security checks in `plan.md`, staging App Check checks, and review of runtime/operator permissions. The frontend and Hosting configuration are implemented; no cloud deployment was performed.

Browser tests remain separate:

```bash
npm run test:e2e:p0
npm run test:e2e:p1
```

For an automatic local run, use `npm run test:e2e:local` (or append `-- --grep @P0`). It starts and stops the app, demo Emulators and test harness. Ports 5173, 4400, 4410, 8080, 9099 and 5001 must be free. The dedicated test Functions entry and clock/fault controls live only in the ignored `.e2e/` bundle; production entry points never import them. Browser tests use real backend transactions through a local transport proxy and feed QR pixels to the real decoder. The test clock also reloads test-only Rules with a matching year; the production Rules remain unchanged and are separately tested against real Emulator request time. Chrome installed on macOS is selected automatically; otherwise install Playwright Chromium and FFmpeg into `.tools/playwright` with `PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/playwright" npx playwright install chromium ffmpeg`. Set `E2E_BROWSER_CHANNEL` to override the browser channel.

The workspace audit reports upstream advisories, including Firebase CLI tooling, the Node-only gRPC dependency of the Firebase browser SDK, and ExcelJS's UUID dependency. The CLI is not shipped in Hosting; the browser build selects Firebase's browser exports and excludes the Node gRPC TLS/server code. Excel import only reads workbook data and does not call UUID v3/v5/v6 with caller-provided buffers. These are scope-specific mitigations, not a clean audit claim. Recheck the full workspace and packaged Functions audits before production deployment and update patched compatible dependencies when available.

## Frontend development

Copy `web/.env.example` to `web/.env.local`. For local development set `VITE_USE_EMULATORS=true`, start `npm run emulators` in one terminal, then `npm run dev` in another. The Google provider uses Auth Emulator's popup; the `e2eTeacher` adapter is only available in development on loopback with Emulators enabled. Production ignores this parameter and omits the adapter from its bundle.

For a real test or production Firebase project, set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and `VITE_APPCHECK_SITE_KEY`, with `VITE_USE_EMULATORS=false`. These Vite values are public web identifiers. Enable Google sign-in, add the Hosting domain to Authentication's authorized domains, register reCAPTCHA Enterprise App Check for that domain, and set the same permitted origin in the backend's `APP_ORIGINS`.

```bash
npm run test:web
npm run build:web
# Operator deployment after configuring the real project:
npx firebase deploy --project YOUR_PRODUCTION_PROJECT --only hosting,functions,firestore
```

Hosting serves `web/dist`, rewrites application routes to `index.html`, caches hashed assets and applies CSP, MIME, referrer and camera permissions headers. Verify OAuth popups and App Check under these headers on the configured staging domain before release. Persistent Firestore caching is disabled. Unresolved scan and edit requests are stored by account with their original request ID and cleared on sign-out; optional filters/recent-class context use session storage.

The web UI uses local Noto Sans Thai, generated success/error WAV sounds, editable Excel review, PNG QR downloads and 4×5 A4 QR PDFs with embedded Sarabun. Font licenses are included beside the fonts. Run real iPhone Safari/Chrome and Android Chrome camera/background tests, verify audible sounds, and scan a printed PDF before release. Automated Emulator tests cannot verify Google OAuth, production App Check, physical cameras or paper readability.
