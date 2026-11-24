import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import type { FirebaseConfigData } from '../types';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

const DEFAULT_DATABASE_ID =
  'ai-studio-sekeluargasesurg-d91da7da-8311-400f-ba70-62abe04c9aad';

const DEFAULT_FIREBASE_CONFIG: FirebaseConfigData = {
  apiKey: 'AIzaSyCApI2xM7BUKVevfA6_qG66HKeVhN_2IxA',
  authDomain: 'formal-office-ndw25.firebaseapp.com',
  projectId: 'formal-office-ndw25',
  storageBucket: 'formal-office-ndw25.firebasestorage.app',
  messagingSenderId: '417273961137',
  appId: '1:417273961137:web:661d5fc4ed89f8bcff6090',
  databaseId: DEFAULT_DATABASE_ID,
};

function readEnvConfig(): FirebaseConfigData | null {
  const apiKey =
    import.meta.env.VITE_FIREBASE_API_KEY?.trim() ||
    DEFAULT_FIREBASE_CONFIG.apiKey;
  const projectId =
    import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    DEFAULT_FIREBASE_CONFIG.projectId;
  if (!apiKey || !projectId) return null;

  return {
    apiKey,
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ||
      DEFAULT_FIREBASE_CONFIG.authDomain ||
      `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
      DEFAULT_FIREBASE_CONFIG.storageBucket ||
      `${projectId}.firebasestorage.app`,
    messagingSenderId:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
      DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId:
      import.meta.env.VITE_FIREBASE_APP_ID?.trim() ||
      DEFAULT_FIREBASE_CONFIG.appId,
    databaseId:
      import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim() ||
      (projectId === 'formal-office-ndw25'
        ? DEFAULT_DATABASE_ID
        : DEFAULT_FIREBASE_CONFIG.databaseId),
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
    cachedDb = config.databaseId
      ? getFirestore(cachedApp, config.databaseId)
      : getFirestore(cachedApp);
    return cachedDb;
  } catch {
    return null;
  }
}
