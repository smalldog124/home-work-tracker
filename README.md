# Teacher Work Tracker

A Thai web app for teachers to record student work with QR codes. Teachers sign in with Google. Students do not need accounts.

## Read Before Writing Code

1. Read [plan.md](plan.md) for UI behavior, backend rules, security, data expiry, and release checks.
2. Use the [tech stack](#tech-stack) and [folder structure](#folder-structure) below when creating or moving code.
3. Find the feature that owns the change in the [file placement rules](#file-placement-rules). Add its code and tests there.
4. Run the checks for the changed behavior. A change is complete when its required checks pass and each new file follows this layout.

This README owns technology choices and file placement. `plan.md` owns product behavior and backend requirements. [requiremen.txt](requiremen.txt) holds the original requirements. Explicit user instructions take priority; update the affected document when a decision changes.

The frontend, backend, shared contracts, Firestore Rules, and tests are implemented. The React frontend lives in `web/` and connects to the existing Firebase callables. Start with the [Thai localhost guide](docs/localhost.md). See [docs/backend.md](docs/backend.md) for the callable contract and [docs/deployment.md](docs/deployment.md) for production prerequisites.

## Tech Stack

| Area | Choice | Reason for this app |
| --- | --- | --- |
| Language | TypeScript with strict checking | Use clear types across browser and backend |
| UI | React | Keep camera, forms, tables, and panels in separate components |
| Web build | Vite | Build static files for Firebase Hosting |
| Routing | React Router, declarative mode | Define Home, Scan, Classes, and class routes in one place |
| Styling | Tailwind CSS | Build the agreed colors and phone layouts |
| UI components | shadcn/ui | Keep editable component code in the project |
| Server data in UI | TanStack Query | Manage loading, refetch, errors, and cache by account and class |
| Validation | Zod | Share request and result schemas while validating again on the backend |
| Browser Firebase access | Firebase Web SDK | Google sign-in, allowed Firestore reads, App Check, and callable actions |
| Backend | Cloud Functions, second generation, with TypeScript and Firebase Admin SDK | Run checked actions and Firestore transactions |
| Database | Cloud Firestore, Standard edition | Store the separate records defined in the plan |
| Hosting and identity | Firebase Hosting, Authentication, and App Check | Serve the static app and protect access |
| Package management | npm workspaces and one root lockfile | Manage `web`, `functions`, and `shared` together |
| Unit and integration tests | Vitest and Firebase Emulator Suite | Test feature logic, transactions, and access rules |
| Browser tests | Playwright | Check complete user flows in browser engines |

Use Firebase callable Functions (`onCall`) as the API entry points. Keep feature logic in services so it can be tested without an HTTP handler. Use scheduled Functions for expiry jobs.

Use supported versions compatible with each other, record them in package manifests, and commit `package-lock.json`. Match the Node runtime to the version supported by Functions when scaffolding. Installed versions and executable commands belong in package manifests.

Feature-specific choices:

- Build Summary with a normal HTML table and CSS sticky headers first. Measure the large-class case before adding table virtualization.
- Use `@zxing/browser` as the initial QR reader and test it on real iPhone and Android devices before release.
- Keep scan state in React state and `useScanSession.ts`. Keep server data in TanStack Query.
- Configure refetch explicitly for the five events in the plan. Clear account data on sign-out. Save retries must use the original request ID.
- Excel uses ExcelJS with file-size/row limits, formula rejection and editable review. PDF uses pdf-lib with @pdf-lib/fontkit and embedded Sarabun for Thai shaping; QR images use qrcode. Files are parsed and generated in the browser. Excel and PDF libraries load only when needed.
- Follow the font and visual requirements in [plan.md](plan.md#2-look-and-feel) and its [QR Files section](plan.md#15-qr-files). Place web and PDF font files in `web/src/assets/fonts/`, with their license files.

## Folder Structure

```text
home-work/
├── README.md                         # Stack, placement rules, and entry guide
├── plan.md                           # Agreed behavior and release checks
├── requiremen.txt                    # Original requirements
├── package.json                      # Workspaces and project commands
├── package-lock.json
├── .gitignore                        # Local secrets and generated output
├── firebase.json                     # Hosting, Functions, and Emulators
├── .firebaserc                       # Test and production project aliases
├── firestore.rules                   # Browser access rules
├── firestore.indexes.json
│
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   └── sounds/                   # Scan success and error sounds
│   └── src/
│       ├── main.tsx
│       ├── app/
│       │   ├── router.tsx            # Route definitions and route guards
│       │   ├── providers.tsx         # Auth and Query providers
│       │   └── AppLayout.tsx         # Shared navigation and page shell
│       ├── lib/
│       │   ├── firebase.ts           # Browser SDK setup
│       │   └── query-client.ts       # Query defaults and cache setup
│       ├── components/
│       │   ├── ui/                   # shadcn/ui component source
│       │   ├── LoadingState.tsx
│       │   └── ErrorState.tsx
│       ├── features/
│       │   ├── home/
│       │   │   └── HomePage.tsx
│       │   ├── auth/
│       │   │   ├── SignInPage.tsx
│       │   │   └── useAuth.ts
│       │   ├── classes/
│       │   │   ├── ClassesPage.tsx
│       │   │   ├── ClassPage.tsx
│       │   │   ├── ClassForm.tsx
│       │   │   └── api.ts
│       │   ├── students/
│       │   │   ├── StudentsTab.tsx
│       │   │   ├── StudentForm.tsx
│       │   │   ├── ExcelReview.tsx
│       │   │   ├── excel.ts
│       │   │   └── api.ts
│       │   ├── tasks/
│       │   │   ├── TasksTab.tsx
│       │   │   ├── TaskForm.tsx
│       │   │   └── api.ts
│       │   ├── scan/
│       │   │   ├── ScanPage.tsx
│       │   │   ├── QrCamera.tsx
│       │   │   ├── PastWorkPanel.tsx
│       │   │   ├── useScanSession.ts
│       │   │   ├── pending-request.ts
│       │   │   └── api.ts
│       │   ├── summary/
│       │   │   ├── SummaryTab.tsx
│       │   │   ├── WorkTable.tsx
│       │   │   ├── WorkStatusForm.tsx
│       │   │   └── api.ts
│       │   └── qr/
│       │       ├── QrDownload.tsx
│       │       ├── pdf.ts
│       │       └── api.ts
│       ├── assets/
│       │   └── fonts/              # Local web/PDF fonts and license files
│       └── styles/
│           └── globals.css
│
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # Export callable and scheduled Functions
│       ├── lib/
│       │   ├── firebase-admin.ts    # Admin SDK setup
│       │   ├── auth.ts              # Session checks and teacher identity
│       │   ├── errors.ts            # Map errors to safe API responses
│       │   └── rate-limit.ts
│       ├── features/
│       │   ├── classes/
│       │   │   ├── actions.ts
│       │   │   └── service.ts
│       │   ├── subjects/
│       │   │   ├── actions.ts
│       │   │   └── service.ts
│       │   ├── students/
│       │   │   ├── actions.ts
│       │   │   ├── service.ts
│       │   │   └── import.ts
│       │   ├── tasks/
│       │   │   ├── actions.ts
│       │   │   └── service.ts
│       │   ├── work/
│       │   │   ├── actions.ts
│       │   │   ├── service.ts
│       │   │   └── service.test.ts
│       │   └── qr/
│       │       ├── actions.ts
│       │       └── service.ts
│       ├── services/
│       │   ├── request-results.ts   # Save-result lookup and retry behavior
│       │   └── audit.ts             # Audit entry helpers
│       └── jobs/
│           └── expire-school-years.ts
│
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # Public exports of shared contracts
│       ├── schemas/
│       │   ├── student.ts
│       │   └── work.ts
│       └── constants/
│           └── work-status.ts
│
├── tests/
│   ├── security/
│   │   └── firestore.rules.test.ts
│   └── e2e/
│       ├── sign-in.spec.ts
│       └── scan-work.spec.ts
│
└── docs/
    ├── deployment.md                # Project setup, build, deploy, rollback
    └── recovery.md                  # Backup, restore, expiry checks
```

The tree shows common entry files. Add tests next to the code they cover, such as `StudentForm.test.tsx`, `excel.test.ts`, or `service.test.ts`. Add new files inside their owning feature when one file has grown into separate responsibilities.

## File Placement Rules

| Work | Location and responsibility |
| --- | --- |
| Page or feature-specific panel | `web/src/features/<feature>/`; keep it with its user flow |
| Shared visual component | `web/src/components/`; move here when multiple features use it |
| Feature reads and callable requests | The feature's `api.ts`; components call these functions instead of using Firebase directly |
| Route and navigation changes | `web/src/app/`; pages remain inside features |
| Browser SDK initialization | `web/src/lib/firebase.ts`; keep initialization in one place |
| Backend action boundary | `functions/src/features/<feature>/actions.ts`; check identity, schema, and rate limits, then call its service |
| Ownership, business rules, and transactions | The feature's `service.ts`; accept the trusted teacher ID and validate related records |
| Excel import transaction | `functions/src/features/students/import.ts`; called by student actions |
| Shared backend behavior | `functions/src/services/`; use only for behavior shared by multiple features |
| Request and result contracts | `shared/src/schemas/`; runtime schemas and inferred TypeScript types |
| Scheduled cleanup | `functions/src/jobs/`; keep it separate from teacher actions |
| Firestore Rules tests | `tests/security/`; use Emulators to test allowed and denied access |
| Browser flows | `tests/e2e/`; test the app through its pages |

Keep the distinction between scanning and recording work clear: `web/features/scan` owns the camera and scan session; `functions/features/work` owns sent statuses and work-save transactions; `functions/features/qr` owns QR generation data, lookup, and replacement.

## Dependency Boundaries

```text
web → shared
functions → shared

web component → feature api.ts → Firebase SDK → callable action
callable action → feature service → Firestore transaction
```

- `web` imports browser-safe code. `functions` imports server code. `shared` contains only browser-safe contracts and constants.
- Keep Admin SDK, secrets, database implementation details, and ownership decisions in `functions`.
- Services can call Firestore directly. Add a separate data-access module only when it makes a feature materially simpler.
- Keep reusable code with its feature until another feature needs it. Use small named helpers rather than a general `utils.ts` for unrelated behavior.
- Keep Firebase transaction writes for work, audit, and request results in the same transaction. Helpers receive that transaction rather than saving independently.
- Build the shared workspace before its consumers. Include shared runtime code in the Functions deployment artifact, either bundled or as a packaged dependency. A deployed Function must not rely on a sibling source directory that Firebase does not upload.

## Example: Change a Student Number

1. `StudentForm.tsx` collects the new number and confirmation.
2. `students/api.ts` sends the shared request shape and loaded data version.
3. `students/actions.ts` checks the session and request schema.
4. `students/service.ts` checks ownership and the version, reserves the new number, replaces the QR, and keeps the internal student ID in one transaction.
5. Audit and request-result helpers add records to that same transaction.
6. The UI shows the confirmed result and refetches the affected data.

Test the changed behavior beside the service. Check the full browser flow in E2E tests when needed. Use the checks in `plan.md` to cover duplicate numbers, replaced QR codes, lost replies, and edits from another device.

## Setup and Maintenance

Current backend commands:

```bash
npm ci
npm run build
npm run typecheck
npm run test:functions
npm run test:integration
npm run emulators
npm run dev
npm run build:web
npm run test:web
npm run test:e2e:local
```

Integration and browser tests require Java 21 and use a local demo Firebase project. `npm test` runs backend and frontend unit tests. `test:e2e:local` starts the app, a dedicated test Functions bundle and Emulator harness, runs Playwright, then stops its services. The build generates `functions/deploy/` as the Firebase upload source, bundling shared runtime contracts so deployment never depends on a sibling workspace. `build:web` builds the Firebase Hosting artifact in `web/dist/`. Production packaging and prerequisites are documented in [docs/deployment.md](docs/deployment.md).

Keep localhost setup in `docs/localhost.md`, deployment steps in `docs/deployment.md`, and recovery steps in `docs/recovery.md`. Record required environment-variable names without secret values. Keep generated build output and local credentials out of version control.

For each implementation change, keep tests close to the changed behavior, update this README when stack or placement changes, and update `plan.md` when product behavior changes.
