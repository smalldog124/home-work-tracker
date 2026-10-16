# Teacher plans and classroom limits

Plans and limits are defined in `shared/src/schemas/plan.ts`. A missing subscription means Starter. Paid plans last 13 calendar months in Bangkok time; shorter months clamp to their final day. Expiry is checked on every create and code request, including the exact expiry instant. All terms and subjects share one usage document per teacher and Buddhist school year. May 1 at midnight in Bangkok starts the next year's usage.

## Admin terminal

There is no web admin endpoint. Run all commands below from the repository root.

### Run with local Emulators

Use Node.js 22, Java 21, and the repository dependencies (`npm ci`). This workflow uses the `demo-home-work` project configured in `.firebaserc` and does not require a real Firebase service-account key.

1. Create `.local/admin-service-account.json` if it does not exist, with the following content. The `.local/` directory is ignored by Git, so a fresh checkout needs this file created locally.

   ```json
   {
     "type": "emulator",
     "project_id": "demo-home-work",
     "client_email": "local-admin@example.test"
   }
   ```

   This file is metadata for this project's admin CLI, not a Google service-account credential. Do not add a private key. `client_email` identifies the local actor in audit records; it is not an authenticated administrator identity.

2. In terminal 1, start the Emulators and wait until they are ready. Keep this terminal running.

   ```sh
   npm run emulators
   ```

   | Service | Local address |
   | --- | --- |
   | Authentication | `127.0.0.1:9099` |
   | Firestore | `127.0.0.1:8080` |
   | Functions | `127.0.0.1:5001` |

3. In terminal 2, start the local web app with Emulator mode enabled.

   ```sh
   VITE_USE_EMULATORS=true npm run dev
   ```

   Open the Vite URL printed in the terminal (normally `http://127.0.0.1:5173`). Choose **เข้าสู่ระบบด้วย Google**, complete the Emulator sign-in dialog, and wait for the home page to load. Use the email from this local teacher account in the admin commands below. The CLI looks up an existing teacher; it does not create the account.

4. In terminal 3, look up the teacher and issue a code. Replace `teacher@example.com` with the email used in step 3.

   ```sh
   npm run plan:admin:local -- find --email teacher@example.com
   npm run plan:admin:local -- create --email teacher@example.com --level level1
   ```

   Use `level1`, `level2`, or `level3`. Check the printed project, teacher, and requested level. At the confirmation prompt, type `demo-home-work`. The command requires an interactive terminal for creation and cancellation.

   The full code is printed once. Copy it for the next step; code listings show only its hash ID.

5. In the local web app, open **ครู → กรอกโค้ด**, paste the code, choose **ตรวจสอบโค้ด**, check the preview, and choose **ยืนยันเปลี่ยนแพ็กเกจ**. Open the teacher menu to see the updated plan.

6. Inspect codes and plan history, or cancel an unused code:

   ```sh
   npm run plan:admin:local -- list --email teacher@example.com
   npm run plan:admin:local -- history --email teacher@example.com
   npm run plan:admin:local -- cancel --code-id SHA256_CODE_ID
   ```

   Replace `SHA256_CODE_ID` with the code ID from `list`, not the full activation code. Type `demo-home-work` to confirm cancellation.

`plan:admin:local` reads `.local/admin-service-account.json` and sets `GOOGLE_APPLICATION_CREDENTIALS`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and `GCLOUD_PROJECT` automatically for the command. You do not need to export them manually. The CLI reads the metadata, then clears `GOOGLE_APPLICATION_CREDENTIALS` in its own process before initializing the Emulator connection. It requires a matching `demo-` project and both local Auth and Firestore hosts.

If the command fails, check that both Emulators are running on the ports above, the metadata file exists with `type: "emulator"` and `project_id: "demo-home-work"`, and the teacher has signed into the same local app. A real Google/Firebase account is not automatically present in the local Auth Emulator. `npm run plan:admin:local -- --help` shows command syntax without connecting to the Emulators.

The current `npm run emulators` command does not import or export data. Treat local users, codes, and subscriptions as temporary across restarts. Keep integration and E2E runners separate from this manual session because they use the same ports/project and reset test data.

### Run against a real Firebase project

Use a trusted Firebase service-account JSON key with permissions to look up Firebase Auth users and transact on Firestore. Store it outside this repository, or at the gitignored `.local/admin-service-account.json` when it contains a real service-account key instead of Emulator metadata. Other credential paths inside the repository are rejected. Its `client_email` is the authenticated audit actor. Use the regular `plan:admin` command without Emulator host variables set in that terminal.

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/repo/admin-service-account.json
npm run plan:admin -- find --email teacher@example.com
npm run plan:admin -- create --email teacher@example.com --level level1
npm run plan:admin -- list --email teacher@example.com
npm run plan:admin -- cancel --code-id SHA256_CODE_ID
npm run plan:admin -- history --email teacher@example.com
```

Supported paid levels are `level1`, `level2`, and `level3`. The credential's project is used by default; an optional `--project` must match it. Before a write, the script shows the project, actor, teacher UID/email, plan and usage. Creation and cancellation require an interactive terminal and typing the project ID to confirm. It never creates a teacher account. Ask the teacher to sign in first.

Activation codes contain exactly 5 uppercase English letters and digits, with at least one of each (for example, `A7K2P`). Input is case-insensitive and surrounding whitespace is ignored. Issuance retries collisions without replacing existing codes. Previously issued long codes no longer pass validation; issue a new code if needed.

The generated full code is shown once. Send it to the teacher outside the website. Do not capture creation output in terminal logs, recordings or redirected files. Firestore, code listings and plan history contain only its SHA-256 ID and metadata. A lost code must be cancelled and replaced. Codes are account-bound, single-use, and valid for 30 days.

## Reliability and cleanup

Code previews do not reserve codes. Confirmation is bound to the account, code, current plan version and displayed Bangkok expiry date. The server computes dates itself. A changed preview requires another confirmation. Successful redemption results live in `planRequests` and survive school-year cleanup. The browser preserves an unresolved redemption request in session storage and retries that same request ID.

Creation, quota checks and usage increments share one Firestore transaction. An absent usage document is accepted as zero only when the year's classroom collection is empty; inconsistent usage requires an admin investigation rather than silently resetting the count.

Deletion marks the class as deleting, decrements that year's usage once, and queues a deterministic job in one transaction. Server access and Firestore Rules block the class immediately. The one-minute scheduled worker deletes students, tasks, work, revisions, QR tokens and linked classroom requests/audit in bounded transactions. Each batch checks the worker's current lease token. Failed work retries with backoff, and abandoned running jobs become eligible after ten minutes. The final transaction removes the parent and completes the job. Classroom recreation is blocked until that transaction, so an earlier worker cannot delete a replacement. Shared subjects, other classes, and plan history remain intact. Minimal successful deletion receipts are kept in the server-only `classDeletionRequests` collection, so replaying a completed deletion cannot remove a replacement classroom with the same ID.

The existing daily school-year cleanup queues the same deletion process and independently removes expired orphan data. It does not decrement the current year's count when cleaning an old classroom. Deletion jobs contain metadata only and never contain full activation codes.

Deploy the updated Firestore Rules and indexes together with the Functions and web changes through the project's normal release process. No deployment is performed by the admin script.

## Local verification

```sh
npm test
npm run typecheck
npm run build
npm run test:integration
npm run test:e2e:local -- --grep @plans
```

Emulator runners require free loopback ports. Do not overlap integration and browser runners because both use the same demo project and reset its database.
