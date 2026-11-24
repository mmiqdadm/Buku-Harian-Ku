import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ChildProfile, CreativeStory, JournalEntry } from '../types';

interface MediaBlobRecord {
  id: string;
  entryId: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

interface BukuHarianDB extends DBSchema {
  profiles: {
    key: string;
    value: ChildProfile;
  };
  entries: {
    key: string;
    value: JournalEntry;
    indexes: {
      'by-child': string;
      'by-child-month': [string, string];
      'by-child-date': [string, string];
    };
  };
  stories: {
    key: string;
    value: CreativeStory;
    indexes: {
      'by-child': string;
    };
  };
  mediaBlobs: {
    key: string;
    value: MediaBlobRecord;
    indexes: {
      'by-entry': string;
    };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

const DB_NAME = 'buku-harian-ku-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<BukuHarianDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<BukuHarianDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BukuHarianDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('entries')) {
          const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
          entryStore.createIndex('by-child', 'childId');
          entryStore.createIndex('by-child-month', ['childId', 'monthKey']);
          entryStore.createIndex('by-child-date', ['childId', 'dateKey']);
        }
        if (!db.objectStoreNames.contains('stories')) {
          const storyStore = db.createObjectStore('stories', { keyPath: 'id' });
          storyStore.createIndex('by-child', 'childId');
        }
        if (!db.objectStoreNames.contains('mediaBlobs')) {
          const mediaStore = db.createObjectStore('mediaBlobs', { keyPath: 'id' });
          mediaStore.createIndex('by-entry', 'entryId');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// Fixed past epoch timestamp for initial local defaults so real edits from
// another device (e.g. tablet -> laptop) always win on first cloud sync.
const DEFAULT_SEED_TS = 1700000000000;

export function createDefaultProfiles(): ChildProfile[] {
  return [
    {
      id: 'umar',
      name: 'Umar',
      nickname: 'Umar',
      birthDate: '',
      hobby: '',
      favoriteFood: '',
      favoriteColor: '',
      dream: '',
      aboutMe: '',
      accentTone: 'forest',
      order: 1,
      createdAt: DEFAULT_SEED_TS,
      updatedAt: DEFAULT_SEED_TS,
      syncStatus: 'local-only',
    },
    {
      id: 'utsman',
      name: 'Utsman',
      nickname: 'Utsman',
      birthDate: '',
      hobby: '',
      favoriteFood: '',
      favoriteColor: '',
      dream: '',
      aboutMe: '',
      accentTone: 'terracotta',
      order: 2,
      createdAt: DEFAULT_SEED_TS,
      updatedAt: DEFAULT_SEED_TS,
      syncStatus: 'local-only',
    },
  ];
}

export async function ensureDefaultProfiles(): Promise<ChildProfile[]> {
  const db = await getDB();
  const existing = await db.getAll('profiles');
  if (existing.length === 0) {
    const defaults = createDefaultProfiles();
    const tx = db.transaction('profiles', 'readwrite');
    for (const profile of defaults) {
      await tx.store.put(profile);
    }
    await tx.done;
    return defaults;
  }
  return existing
    .filter((p) => !p.deleted)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function getAllProfiles(includeDeleted = false): Promise<ChildProfile[]> {
  const db = await getDB();
  const all = await db.getAll('profiles');
  const filtered = includeDeleted ? all : all.filter((p) => !p.deleted);
  return filtered.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export async function saveProfileLocal(profile: ChildProfile): Promise<void> {
  const db = await getDB();
  await db.put('profiles', profile);
}

export async function getEntriesByChild(
  childId: string,
  includeDeleted = false
): Promise<JournalEntry[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('entries', 'by-child', childId);
  const filtered = includeDeleted ? items : items.filter((e) => !e.deleted);
  return filtered.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return b.createdAt - a.createdAt;
  });
}

export async function getAllEntries(includeDeleted = false): Promise<JournalEntry[]> {
  const db = await getDB();
  const items = await db.getAll('entries');
  return includeDeleted ? items : items.filter((e) => !e.deleted);
}

export async function getEntryById(id: string): Promise<JournalEntry | undefined> {
  const db = await getDB();
  return db.get('entries', id);
}

export async function saveEntryLocal(entry: JournalEntry): Promise<void> {
  const db = await getDB();
  await db.put('entries', entry);
}

export async function saveMediaBlobLocal(
  id: string,
  entryId: string,
  blob: Blob
): Promise<void> {
  const db = await getDB();
  await db.put('mediaBlobs', {
    id,
    entryId,
    mimeType: blob.type || 'application/octet-stream',
    blob,
    updatedAt: Date.now(),
  });
}

export async function getMediaBlobLocal(id: string): Promise<Blob | null> {
  const db = await getDB();
  const rec = await db.get('mediaBlobs', id);
  return rec ? rec.blob : null;
}

export async function deleteMediaBlobLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('mediaBlobs', id);
}

export async function deleteMediaBlobsByEntryLocal(entryId: string): Promise<void> {
  const db = await getDB();
  const blobs = await db.getAllFromIndex('mediaBlobs', 'by-entry', entryId);
  if (blobs.length === 0) return;
  const tx = db.transaction('mediaBlobs', 'readwrite');
  for (const b of blobs) {
    await tx.store.delete(b.id);
  }
  await tx.done;
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const rec = await db.get('meta', key);
  return rec ? (rec.value as T) : null;
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

export async function getAllStories(includeDeleted = false): Promise<CreativeStory[]> {
  const db = await getDB();
  const all = await db.getAll('stories');
  const filtered = includeDeleted ? all : all.filter((s) => !s.deleted);
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStoriesByChild(
  childId: string,
  includeDeleted = false
): Promise<CreativeStory[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('stories', 'by-child', childId);
  const filtered = includeDeleted ? all : all.filter((s) => !s.deleted);
  return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStoryById(id: string): Promise<CreativeStory | undefined> {
  const db = await getDB();
  return db.get('stories', id);
}

export async function saveStoryLocal(story: CreativeStory): Promise<void> {
  const db = await getDB();
  await db.put('stories', story);
}

export async function deleteStoryLocal(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('stories', id);
}
