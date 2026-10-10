import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Context } from './firebase-admin';
export function testContext() {
  const projectId = process.env.GCLOUD_PROJECT ?? 'demo-home-work';
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!projectId.startsWith('demo-') || !host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Integration tests require local Firestore Emulator and a demo- project ID.');
  const app = getApps().find(app => app.name === 'integration') ?? initializeApp({ projectId }, 'integration');
  let now = new Date('2026-10-10T05:00:00.000Z');
  const ctx: Context = { db: getFirestore(app), now: () => now };
  return { ctx, app, setNow: (date: string) => { now = new Date(date); }, async clear() {
    const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Cannot clear emulator: ${response.status}`);
    now = new Date('2026-10-10T05:00:00.000Z');
  } };
}
