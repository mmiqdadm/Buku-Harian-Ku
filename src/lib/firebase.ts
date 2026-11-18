import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import type { FirebaseConfigData } from '../types';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

function readEnvConfig(): FirebaseConfigData | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!apiKey || !projectId) return null;

  return {
    apiKey,
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
      `${projectId}.firebasestorage.app`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '',
  };
}

export function isFirebaseConfigured(): boolean {
  return readEnvConfig() !== null;
}

export function getFirestoreInstance(): Firestore | null {
  if (cachedDb) return cachedDb;
  const config = readEnvConfig();
  if (!config) return null;

  try {
    const existing = getApps().find((a) => a.name === 'buku-harian-app');
    cachedApp = existing ?? initializeApp(config, 'buku-harian-app');
    cachedDb = getFirestore(cachedApp);
    return cachedDb;
  } catch {
    return null;
  }
}
