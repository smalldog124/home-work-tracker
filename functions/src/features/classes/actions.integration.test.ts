import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { testContext } from '../../lib/test-context';
const { ctx, app, clear } = testContext();
const project = process.env.GCLOUD_PROJECT ?? 'demo-home-work';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const functionHost = '127.0.0.1:5001';
let token: string; let uid: string;
async function call(name: string, data: unknown, idToken?: string) {
  const response = await fetch(`http://${functionHost}/${project}/asia-southeast1/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) }, body: JSON.stringify({ data }) });
  return { status: response.status, body: await response.json() };
}
beforeEach(async () => {
  await clear();
  if (!authHost || !/^(127\.0\.0\.1|localhost):\d+$/.test(authHost)) throw new Error('Auth Emulator required');
  const reset = await fetch(`http://${authHost}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' });
  if (!reset.ok) throw new Error('Cannot clear Auth Emulator');
  const fakeGoogleToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: randomUUID(), iss: 'https://accounts.google.com', aud: 'test-google-client', email: 'teacher@example.test', email_verified: true, name: 'ครูทดสอบ' })).toString('base64url')}.`;
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: `id_token=${fakeGoogleToken}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true }) });
  const identity = await response.json();
  if (!response.ok) throw new Error(`Auth seed failed: ${JSON.stringify(identity)}`);
  token = identity.idToken; uid = identity.localId;
});
const input = () => ({ requestId: randomUUID(), year: 2569, term: 1, subject: 'คณิต', group: 'ม.1' });
it('real callable verifies Google token and creates class', async () => {
  const response = await call('createClass', input(), token); expect(response.status).toBe(200);
  expect(response.body.result).toMatchObject({ year: 2569, subject: 'คณิต' });
  expect((await ctx.db.doc(`teachers/${uid}/classes/${response.body.result.classId}`).get()).data()?.ownerId).toBe(uid);
});
it('real callable denies missing and forged tokens', async () => {
  expect((await call('createClass', input())).body.error.status).toBe('UNAUTHENTICATED');
  expect((await call('createClass', input(), 'forged')).body.error.status).toBe('UNAUTHENTICATED');
});
it('real callable rejects extra ownership, timestamps and invalid import rows', async () => {
  const response = await call('createClass', { ...input(), ownerId: 'victim', savedAt: 'yesterday' }, token);
  expect(response.body.error).toMatchObject({ status: 'INVALID_ARGUMENT', details: { reason: 'INVALID_INPUT' } });
  expect(JSON.stringify(response.body)).not.toContain('victim');
  const klass = (await call('createClass', input(), token)).body.result;
  const bad = await call('importStudents', { requestId: randomUUID(), classId: klass.classId, expectedRosterVersion: 0, rows: [{ number: '01', name: 'หนึ่ง' }, { number: 1, name: 'ซ้ำ' }] }, token);
  expect(bad.body.error.status).toBe('INVALID_ARGUMENT');
  expect((await ctx.db.doc(`teachers/${uid}/classes/${klass.classId}`).collection('students').get()).size).toBe(0);
});
it('disabled account is rejected even with previously issued token', async () => {
  await getAuth(app).updateUser(uid, { disabled: true });
  expect((await call('createClass', input(), token)).body.error.status).toBe('UNAUTHENTICATED');
});
it('revoked session is rejected by callable', async () => {
  await new Promise(resolve => setTimeout(resolve, 1100));
  await getAuth(app).revokeRefreshTokens(uid);
  expect((await call('createClass', input(), token)).body.error.status).toBe('UNAUTHENTICATED');
});

it('refreshing the teacher profile cannot remove the saved plan', async () => {
  const planRef = ctx.db.doc(`teachers/${uid}/subscription/current`);
  const plan = { planId: 'level2', startedAt: Timestamp.fromDate(ctx.now()), expiresAt: Timestamp.fromDate(new Date('2027-11-10T05:00:00.000Z')), lastCodeId: 'seed-code', version: 1, updatedAt: Timestamp.fromDate(ctx.now()) };
  await planRef.set(plan);
  // Deliberately force the profile replacement path in getTeacher.
  await ctx.db.doc(`teachers/${uid}`).set({ ownerId: uid, name: 'ชื่อเก่า', email: 'old@example.test' });
  const response = await call('getTeacher', {}, token);
  expect(response.status).toBe(200);
  expect(response.body.result).toMatchObject({ email: 'teacher@example.test' });
  expect((await planRef.get()).data()).toEqual(plan);
});

it.each(['previewPlanCode', 'redeemPlanCode'])('%s requires an authenticated Google session', async name => {
  const data = { code: 'a-long-unknown-code-with-at-least-32-characters', ...(name === 'redeemPlanCode' ? { requestId: randomUUID(), previewToken: 'fake' } : {}) };
  for (const idToken of [undefined, 'forged']) {
    const response = await call(name, data, idToken);
    expect(response.body.error?.status).toBe('UNAUTHENTICATED');
  }
});

it.each(['previewPlanCode', 'redeemPlanCode'])('%s rate-limits code guessing before looking up the code', async name => {
  // Exhaust the existing distributed limiter fixture without issuing many HTTP calls.
  await ctx.db.doc(`teachers/${uid}/rateLimits/${name}`).set({ count: 10000, resetAt: Timestamp.fromMillis(Date.now() + 60000), expiresAt: Timestamp.fromMillis(Date.now() + 86400000) });
  const data = { code: 'a-long-unknown-code-with-at-least-32-characters', ...(name === 'redeemPlanCode' ? { requestId: randomUUID(), previewToken: 'fake' } : {}) };
  const response = await call(name, data, token);
  expect(response.body.error).toMatchObject({ status: 'RESOURCE_EXHAUSTED', details: { reason: 'RATE_LIMIT' } });
  expect((await ctx.db.doc(`teachers/${uid}/subscription/current`).get()).exists).toBe(false);
});
