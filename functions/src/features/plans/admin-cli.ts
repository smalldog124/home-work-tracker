import { realpath, readFile } from 'node:fs/promises';
import { relative, isAbsolute, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { paidPlanIdSchema } from '@home-work/shared';
import { createPlanCode, cancelPlanCode, findTeacher, listPlanCodes, getPlanHistory } from './admin';
import { resolveAdminConfig } from './admin-config';

export async function runAdminCli(args: string[], repoRoot: string) {
  const [command, ...options] = args;
  if (!['find', 'create', 'list', 'cancel', 'history'].includes(command ?? '')) {
    console.log('Usage: npm run plan:admin -- <find|create|list|history> --email teacher@example.com [--level level1|level2|level3]\n       npm run plan:admin -- cancel --code-id HASH\nProduction: GOOGLE_APPLICATION_CREDENTIALS points to a service-account JSON file outside the repository or at .local/admin-service-account.json (gitignored).\nLocal Emulators: npm run plan:admin:local -- <command> [options] (no private key required).');
    if (command && command !== '--help') throw new Error('Unknown command');
    return;
  }
  const flags = new Map<string, string>();
  for (let i = 0; i < options.length; i += 2) {
    if (!['--email', '--level', '--code-id', '--project'].includes(options[i]) || !options[i + 1] || flags.has(options[i])) throw new Error('Invalid or duplicate argument');
    flags.set(options[i], options[i + 1]);
  }
  const location = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!location) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account file');
  const credentialPath = await realpath(location);
  const root = await realpath(repoRoot);
  const inside = relative(root, credentialPath);
  const outside = inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside);
  const localCredential = inside === ['.local', 'admin-service-account.json'].join(sep);
  if (!outside && !localCredential) throw new Error('Keep credentials outside the repository or at .local/admin-service-account.json');
  const account = JSON.parse(await readFile(credentialPath, 'utf8'));
  const { projectId, actorId, emulators } = resolveAdminConfig(account, process.env, flags.get('--project'));
  // Emulator metadata is not a Google credential. Do not pass it to ADC.
  if (emulators) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const app = initializeApp(emulators ? { projectId } : { projectId, credential: cert(account) }, 'plan-admin');
  const ctx = { db: getFirestore(app), now: () => new Date(), auth: getAuth(app) };
  let email = flags.get('--email');
  const codeId = flags.get('--code-id');
  if (command === 'cancel') {
    if (!codeId || !/^[a-f0-9]{64}$/.test(codeId)) throw new Error('Provide --code-id with the code hash');
    const code = await ctx.db.doc(`planCodes/${codeId}`).get();
    if (!code.exists) throw new Error('Code not found');
    email = (await getAuth(app).getUser(code.data()!.teacherUid)).email;
  }
  if (!email) throw new Error('Provide --email for an existing teacher');
  const teacher = await findTeacher(ctx, { email });
  console.log(JSON.stringify({ projectId, actorId, emulators, teacher }, null, 2));
  if (command === 'find') return;
  if (command === 'list') { console.log(JSON.stringify(await listPlanCodes(ctx, { email }), null, 2)); return; }
  if (command === 'history') { console.log(JSON.stringify(await getPlanHistory(ctx, { email }), null, 2)); return; }
  const level = command === 'create' ? paidPlanIdSchema.parse(flags.get('--level')) : undefined;
  console.log(command === 'create' ? `Create ${level} code for ${email}` : `Cancel code ${codeId}`);
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Writes require interactive terminal confirmation');
  const terminal = createInterface({ input: stdin, output: stdout });
  let answer: string;
  try { answer = await terminal.question(`Type ${projectId} to confirm: `); }
  finally { terminal.close(); }
  if (answer !== projectId) { console.log('Cancelled; no changes made.'); return; }
  if (command === 'create') {
    const { code, ...details } = await createPlanCode(ctx, actorId, { email, planId: level! });
    console.log(JSON.stringify(details, null, 2));
    console.log(`Code (shown once): ${code}`);
  } else console.log(JSON.stringify(await cancelPlanCode(ctx, actorId, { codeId: codeId! }), null, 2));
}
