interface AdminAccount {
  type?: string;
  project_id?: string;
  client_email?: string;
}

export function resolveAdminConfig(account: AdminAccount, env: NodeJS.ProcessEnv, requestedProject?: string) {
  if (!account.project_id || !account.client_email) throw new Error('Admin project and actor are required');
  const projectId = requestedProject ?? account.project_id;
  if (projectId !== account.project_id) throw new Error('The project must match the admin configuration project');
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  const emulators = Boolean(firestoreHost || authHost || account.type === 'emulator');
  if (emulators) {
    const localHost = /^(127\.0\.0\.1|localhost):([1-9]\d{0,4})$/;
    if (!projectId.startsWith('demo-') || !localHost.test(firestoreHost ?? '') || !localHost.test(authHost ?? '')) {
      throw new Error('Emulator admin requires a demo- project and both local Auth and Firestore Emulator hosts');
    }
    if (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== projectId) throw new Error('The project must match the Emulator project');
    if (account.type !== 'emulator') throw new Error('Use emulator configuration for local admin');
  } else if (account.type !== 'service_account') {
    throw new Error('A trusted service-account credential is required');
  }
  return { projectId, actorId: account.client_email, emulators };
}
