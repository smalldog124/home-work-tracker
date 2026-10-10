import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
let env: RulesTestEnvironment;
const thai = new Date(Date.now() + 7 * 3600000);
const year = thai.getUTCFullYear() + 543 - (thai.getUTCMonth() < 4 ? 1 : 0);
beforeAll(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Local Firestore Emulator is required');
  const [hostname, port] = host.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-home-work', firestore: { host: hostname, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [id, y] of [['current', year], ['old', year - 3], ['future', year + 1]] as const) {
      await setDoc(doc(db, `teachers/a/classes/${id}`), { ownerId: 'a', year: y, term: 1 });
      for (const name of ['students', 'tasks', 'work', 'workVersions']) await setDoc(doc(db, `teachers/a/classes/${id}/${name}/one`), { name: 'ส่วนตัว' });
    }
    await setDoc(doc(db, 'teachers/a/subjects/one'), { name: 'คณิต' });
    for (const path of ['teachers/a/auditEntries/one', 'teachers/a/requestResults/one', 'teachers/a/rateLimits/one', 'qrTokens/one']) await setDoc(doc(db, path), { secret: 'backend-only' });
  });
});
const db = (uid = 'a', provider = 'google.com') => env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).firestore();
it('owner can read own retained classes, children and subjects', async () => {
  for (const path of ['teachers/a/classes/current', 'teachers/a/classes/current/students/one', 'teachers/a/classes/current/tasks/one', 'teachers/a/classes/current/work/one', 'teachers/a/subjects/one']) await assertSucceeds(getDoc(doc(db(), path)));
});
it('filtered year/term queries work and unrestricted class queries fail', async () => {
  await assertSucceeds(getDocs(query(collection(db(), 'teachers/a/classes'), where('year', '==', year), where('term', '==', 1))));
  await assertFails(getDocs(collection(db(), 'teachers/a/classes')));
});
it('anonymous, other teacher and non-Google sessions cannot read', async () => {
  for (const client of [env.unauthenticatedContext().firestore(), db('b'), db('a', 'password')]) await assertFails(getDoc(doc(client, 'teachers/a/classes/current')));
});
it.each(['old', 'future'])('year %s cannot be accessed before cleanup', async id => {
  await assertFails(getDoc(doc(db(), `teachers/a/classes/${id}`)));
  await assertFails(getDoc(doc(db(), `teachers/a/classes/${id}/students/one`)));
});
it('all direct browser writes are denied', async () => {
  for (const path of ['teachers/a', 'teachers/a/subjects/one', 'teachers/a/classes/current', 'teachers/a/classes/current/students/one', 'teachers/a/classes/current/tasks/one', 'teachers/a/classes/current/work/one']) await assertFails(setDoc(doc(db(), path), { forged: true }));
});
it('QR, requests, audit, versions and rate limits are backend-only', async () => {
  for (const path of ['qrTokens/one', 'teachers/a/auditEntries/one', 'teachers/a/requestResults/one', 'teachers/a/rateLimits/one', 'teachers/a/classes/current/workVersions/one']) {
    await assertFails(getDoc(doc(db(), path))); await assertFails(setDoc(doc(db(), path), { forged: true }));
  }
});
it('child access fails when parent is missing', async () => {
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'teachers/a/classes/missing/students/one'), { name: 'orphan' }));
  await assertFails(getDoc(doc(db(), 'teachers/a/classes/missing/students/one')));
});
