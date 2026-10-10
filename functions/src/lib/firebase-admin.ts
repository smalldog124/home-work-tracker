import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
export const adminApp = getApps()[0] ?? initializeApp();
export const db = getFirestore(adminApp);
export interface Context { db: Firestore; now: () => Date }
export const context: Context = { db, now: () => new Date() };
