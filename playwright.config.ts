import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
for (const url of [baseURL, process.env.E2E_HARNESS_URL ?? 'http://127.0.0.1:4400']) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('E2E only permits loopback app and Emulator harness URLs.');
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/support/global-setup.ts',
  fullyParallel: false,
  workers: 1, // Shared emulator clock and fault controls require isolation.
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    timezoneId: 'Asia/Bangkok',
    locale: 'th-TH',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
