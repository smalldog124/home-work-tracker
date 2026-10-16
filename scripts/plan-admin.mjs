import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args[0] === '--emulators') {
  args.shift();
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(root, '.local/admin-service-account.json');
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.GCLOUD_PROJECT = 'demo-home-work';
}
await mkdir(resolve(root, '.tools'), { recursive: true });
const outfile = resolve(root, '.tools/plan-admin.cjs');
await build({ entryPoints: [resolve(root, 'functions/src/features/plans/admin-cli.ts')], outfile, bundle: true, platform: 'node', target: 'node22', external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'] });
try { await createRequire(import.meta.url)(outfile).runAdminCli(args, root); }
catch (error) {
  // Do not dump credential objects, inputs or SDK errors into terminal history/logs.
  console.error(error?.details?.reason ?? (error?.name === 'ZodError' ? 'Invalid command input' : 'Admin command failed. Check arguments, credentials, account and project permissions.'));
  process.exitCode = 1;
}
