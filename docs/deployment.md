# Development and deployment

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

`npm run build` builds shared first, bundles it and Zod into the Functions entry point, then generates `functions/deploy/` with only the external Firebase runtime dependencies. Firebase uses this generated folder as its source. It does not upload a dependency on the sibling shared workspace. The artifact pins Firebase dependencies to installed lockfile versions. `npm run package:functions` also generates the artifact's installation lockfile. Both build folders and generated deployment output are ignored by git.

Before production deployment, choose a separate real Firebase project, enable Google Authentication and App Check, configure Firestore in Singapore, and put the permitted HTTPS browser origins in `functions/.env`:

```text
APP_ORIGINS=https://your-app.web.app
```

Build packaging copies that ignored environment file into the deployment artifact. Production callables reject calls when origins are unconfigured and enforce valid App Check tokens. Emulator configuration is not production configuration. Avoid secrets in environment files; use Secret Manager for any future secrets.

The following is an operator command, not a command executed by this implementation:

```bash
npx firebase deploy --project YOUR_PRODUCTION_PROJECT --only functions,firestore
```

The predeploy step builds and packages automatically. Do not deploy to a `demo-` project; it exists only for Emulators. A production release also requires the backup/restore and security checks in `plan.md`, staging App Check checks, and review of runtime/operator permissions. No Hosting or UI has been implemented.

Browser tests remain separate:

```bash
npm run test:e2e:p0
npm run test:e2e:p1
```

They require the future frontend and its E2E harness; backend tests do not claim that browser E2E flows pass.

Production dependency verification (`npm audit --omit=dev` and the packaged runtime audit) reported zero vulnerabilities. The full workspace audit still reports development-only advisories in Firebase CLI, Rules-test browser SDK and Excel fixture dependencies. Tests use loopback Emulators, fixed repository-controlled patterns and synthetic workbooks; those packages are excluded from the deployment artifact. Review/update these tools before exposing development tooling to untrusted inputs or changing CI trust boundaries.
