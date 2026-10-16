import { describe, expect, it } from 'vitest';
import { resolveAdminConfig } from './admin-config';

const account = { type: 'emulator', project_id: 'demo-home-work', client_email: 'local-admin@example.test' };
const env = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', GCLOUD_PROJECT: 'demo-home-work' };

describe('admin connection configuration', () => {
  it('accepts local emulator metadata without a private key', () => {
    expect(resolveAdminConfig(account, env)).toEqual({ projectId: 'demo-home-work', actorId: 'local-admin@example.test', emulators: true });
  });

  it.each([
    {},
    { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
    { ...env, FIRESTORE_EMULATOR_HOST: 'remote.example:8080' },
    { ...env, FIREBASE_AUTH_EMULATOR_HOST: 'https://localhost:9099' },
    { ...env, GCLOUD_PROJECT: 'demo-another-project' },
  ])('rejects missing, remote or mismatched emulator configuration: %j', invalidEnv => {
    expect(() => resolveAdminConfig(account, invalidEnv)).toThrow();
  });

  it('rejects a real project in emulator mode', () => {
    expect(() => resolveAdminConfig({ ...account, project_id: 'real-project' }, env)).toThrow();
  });

  it('rejects a project override that differs from the configuration', () => {
    expect(() => resolveAdminConfig(account, env, 'demo-another')).toThrow();
  });

  it('keeps production service-account mode separate from emulator mode', () => {
    const production = { type: 'service_account', project_id: 'real-project', client_email: 'admin@real-project.iam.gserviceaccount.com' };
    expect(resolveAdminConfig(production, {})).toEqual({ projectId: 'real-project', actorId: production.client_email, emulators: false });
    expect(() => resolveAdminConfig(production, env)).toThrow();
  });
});
