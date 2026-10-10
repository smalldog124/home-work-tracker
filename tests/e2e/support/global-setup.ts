import { request, type FullConfig } from '@playwright/test';

export default async function setup(config: FullConfig) {
  const harness = process.env.E2E_HARNESS_URL ?? 'http://127.0.0.1:4400';
  const client = await request.newContext({ timeout: 5_000 });
  try {
    const response = await client.get(`${harness}/__e2e/health`);
    if (!response.ok()) throw new Error(`Harness health returned ${response.status()}`);
    const health = await response.json();
    if (health.emulators !== true || !String(health.projectId).startsWith('demo-')) {
      throw new Error('Harness must use Auth, Firestore and Functions Emulators with a demo- project ID.');
    }
    const app = await client.get(config.projects[0].use.baseURL!);
    if (!app.ok()) throw new Error(`Application returned ${app.status()}`);
  } catch (error) {
    throw new Error(`E2E prerequisites missing. Start the app and Emulator harness described in tests/e2e/README.md. ${error}`);
  } finally {
    await client.dispose();
  }
}
