import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const env = import.meta.env;
const lanEmulators = env.DEV && env.VITE_LAN_EMULATORS === "true";
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
  location.hostname,
);
export const useEmulators =
  env.DEV && (loopback || lanEmulators) && env.VITE_USE_EMULATORS === "true";

export const configured =
  useEmulators ||
  Boolean(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID &&
    env.VITE_APPCHECK_SITE_KEY,
  );
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "demo-home-work.firebaseapp.com",
  projectId: useEmulators
    ? "demo-home-work"
    : env.VITE_FIREBASE_PROJECT_ID || "demo-home-work",
  appId: env.VITE_FIREBASE_APP_ID || "demo-app",
});
export const auth = getAuth(app);
export const db = initializeFirestore(
  app,
  {
    localCache: memoryLocalCache(),
    ...(lanEmulators ? { host: location.host, ssl: true } : {}),
  },
  useEmulators ? "(default)" : env.VITE_FIRESTORE_DATABASE_ID?.trim() || "(default)",
);
export const functions = getFunctions(
  app,
  lanEmulators ? `${location.origin}/__emulator/functions` : "asia-southeast1",
);
if (useEmulators && lanEmulators) {
  connectAuthEmulator(auth, location.origin, { disableWarnings: true });
} else if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(
    functions,
    "127.0.0.1",
    env.VITE_E2E_PROXY === "true" ? 4400 : 5001,
  );
} else if (configured) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
