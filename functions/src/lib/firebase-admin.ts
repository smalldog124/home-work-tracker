import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
export const adminApp = getApps()[0] ?? initializeApp();
const databaseId = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST
  ? '(default)'
  : process.env.FIRESTORE_DATABASE_ID?.trim() || '(default)';
export const db = getFirestore(adminApp, databaseId);
export interface Context { db: Firestore; now: () => Date; auth?: Auth }
export const context: Context = { db, now: () => new Date(), auth: getAuth(adminApp) };
