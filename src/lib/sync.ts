import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import type {
  ChildProfile,
  CreativeStory,
  JournalEntry,
  MediaAttachment,
  SyncStateSummary,
} from '../types';
import {
  getDB,
  getAllEntries,
  getAllProfiles,
  getAllStories,
  getEntryById,
  getMediaBlobLocal,
  getMetaValue,
  getStoryById,
  saveEntryLocal,
  saveMediaBlobLocal,
  saveProfileLocal,
  saveStoryLocal,
  setMetaValue,
} from './db';
import { getFirestoreInstance, isFirebaseConfigured } from './firebase';
import { blobToDataUrl, dataUrlToBlob } from './media';

const PROFILES_COL = 'bhk_profiles';
const ENTRIES_COL = 'bhk_entries';
const STORIES_COL = 'bhk_stories';
const MEDIA_COL = 'bhk_media';
const LAST_SYNC_META_KEY = 'lastSyncedAt';

// Keep Firestore document payloads comfortably below the 1 MiB Firestore document limit.
const MAX_MEDIA_CHUNK_CHARS = 720_000;

let syncInFlight: Promise<SyncStateSummary> | null = null;

function splitChunks(dataUrl: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < dataUrl.length; i += MAX_MEDIA_CHUNK_CHARS) {
    chunks.push(dataUrl.slice(i, i + MAX_MEDIA_CHUNK_CHARS));
  }
  return chunks;
}

async function pushMediaAttachment(entryId: string, att: MediaAttachment): Promise<MediaAttachment> {
  const db = getFirestoreInstance();
  if (!db) return att;

  const blob = await getMediaBlobLocal(att.id);
  if (!blob) return att;

  const dataUrl = await blobToDataUrl(blob);
  const chunks = splitChunks(dataUrl);

  // Store metadata + chunk 0 in main media doc, overflow chunks in sub-docs if voice note is long
  await setDoc(doc(db, MEDIA_COL, att.id), {
    id: att.id,
    entryId,
    type: att.type,
    mimeType: att.mimeType,
    chunkCount: chunks.length,
    chunk0: chunks[0] ?? '',
    updatedAt: Date.now(),
  });

  for (let i = 1; i < chunks.length; i++) {
    await setDoc(doc(db, MEDIA_COL, `${att.id}_part_${i}`), {
      parentId: att.id,
      entryId,
      index: i,
      data: chunks[i],
    });
  }

  return { ...att, remoteSynced: true };
}

export async function ensureMediaBlobAvailable(att: MediaAttachment): Promise<Blob | null> {
  const local = await getMediaBlobLocal(att.id);
  if (local) return local;

  const db = getFirestoreInstance();
  if (!db || !navigator.onLine) return null;

  try {
    const snap = await getDoc(doc(db, MEDIA_COL, att.id));
    if (!snap.exists()) return null;
    const data = snap.data() as {
      entryId?: string;
      chunkCount?: number;
      chunk0?: string;
    };

    const parts: string[] = [data.chunk0 ?? ''];
    const total = data.chunkCount ?? 1;
    for (let i = 1; i < total; i++) {
      const partSnap = await getDoc(doc(db, MEDIA_COL, `${att.id}_part_${i}`));
      if (partSnap.exists()) {
        parts.push((partSnap.data() as { data?: string }).data ?? '');
      }
    }

    const fullDataUrl = parts.join('');
    if (!fullDataUrl) return null;
    const blob = await dataUrlToBlob(fullDataUrl);
    await saveMediaBlobLocal(att.id, data.entryId ?? 'remote', blob);
    return blob;
  } catch {
    return null;
  }
}

export async function countPendingSync(): Promise<number> {
  const [profiles, entries, stories] = await Promise.all([
    getAllProfiles(true),
    getAllEntries(true),
    getAllStories(true),
  ]);
  const pendingProfiles = profiles.filter((p) => p.syncStatus === 'pending').length;
  const pendingEntries = entries.filter((e) => e.syncStatus === 'pending').length;
  const pendingStories = stories.filter((s) => s.syncStatus === 'pending').length;
  return pendingProfiles + pendingEntries + pendingStories;
}

export async function getSyncSummary(
  syncing = false,
  lastError: string | null = null
): Promise<SyncStateSummary> {
  const [pendingCount, lastSyncedAt] = await Promise.all([
    countPendingSync(),
    getMetaValue<number>(LAST_SYNC_META_KEY),
  ]);
  return {
    configured: isFirebaseConfigured(),
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncing,
    pendingCount,
    lastSyncedAt,
    lastError,
  };
}

async function deleteRemoteMedia(attId: string): Promise<void> {
  const db = getFirestoreInstance();
  if (!db) return;
  try {
    const mainRef = doc(db, MEDIA_COL, attId);
    const snap = await getDoc(mainRef);
    const chunkCount = snap.exists()
      ? ((snap.data() as { chunkCount?: number }).chunkCount ?? 1)
      : 1;
    await deleteDoc(mainRef);
    for (let i = 1; i < chunkCount; i++) {
      try {
        await deleteDoc(doc(db, MEDIA_COL, `${attId}_part_${i}`));
      } catch {
        // ignore missing chunk
      }
    }
  } catch {
    // ignore missing media doc
  }
}

function stripUndefined<T extends object>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function serializeAttachment(att: MediaAttachment): Record<string, unknown> {
  return stripUndefined({
    id: att.id,
    type: att.type,
    mimeType: att.mimeType,
    durationSec: att.durationSec,
    caption: att.caption,
    remoteSynced: att.remoteSynced,
    remoteUrl: att.remoteUrl,
    createdAt: att.createdAt,
  });
}

/**
 * Realtime Sync Callbacks & Subscription
 */
export interface RealtimeSyncCallbacks {
  onProfilesUpdated?: () => void;
  onEntriesUpdated?: () => void;
  onStoriesUpdated?: () => void;
  onStatusChanged?: (summary: SyncStateSummary) => void;
  onError?: (error: string) => void;
}

export function subscribeToRealtimeSync(callbacks: RealtimeSyncCallbacks): () => void {
  const db = getFirestoreInstance();
  if (!db) {
    return () => {};
  }

  let isInitialProfiles = true;
  let isInitialEntries = true;
  let isInitialStories = true;

  const unsubProfiles = onSnapshot(
    collection(db, PROFILES_COL),
    async (snapshot) => {
      try {
        let hasChanges = false;
        const idb = await getDB();

        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const remote = change.doc.data() as ChildProfile;
            const local = await idb.get('profiles', remote.id);
            if (
              !local ||
              remote.updatedAt > local.updatedAt ||
              (remote.updatedAt === local.updatedAt && local.syncStatus !== 'synced')
            ) {
              await saveProfileLocal({ ...remote, syncStatus: 'synced' });
              hasChanges = true;
            }
          } else if (change.type === 'removed') {
            const local = await idb.get('profiles', change.doc.id);
            if (local && !local.deleted) {
              await saveProfileLocal({ ...local, deleted: true, syncStatus: 'synced' });
              hasChanges = true;
            }
          }
        }

        if (hasChanges || isInitialProfiles) {
          isInitialProfiles = false;
          await setMetaValue(LAST_SYNC_META_KEY, Date.now());
          callbacks.onProfilesUpdated?.();
        }

        const summary = await getSyncSummary(false, null);
        callbacks.onStatusChanged?.(summary);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Gagal memproses pembaruan profil realtime';
        callbacks.onError?.(msg);
      }
    },
    (err) => {
      const msg = err.message || 'Koneksi realtime profil terputus';
      void getSyncSummary(false, msg).then((s) => callbacks.onStatusChanged?.(s));
      callbacks.onError?.(msg);
    }
  );

  const unsubEntries = onSnapshot(
    collection(db, ENTRIES_COL),
    async (snapshot) => {
      try {
        let hasChanges = false;

        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const remote = change.doc.data() as JournalEntry;
            const local = await getEntryById(remote.id);
            if (
              !local ||
              remote.updatedAt > local.updatedAt ||
              (remote.updatedAt === local.updatedAt && local.syncStatus !== 'synced')
            ) {
              await saveEntryLocal({ ...remote, syncStatus: 'synced' });
              hasChanges = true;
            }
          } else if (change.type === 'removed') {
            const local = await getEntryById(change.doc.id);
            if (local && !local.deleted) {
              await saveEntryLocal({ ...local, deleted: true, syncStatus: 'synced' });
              hasChanges = true;
            }
          }
        }

        if (hasChanges || isInitialEntries) {
          isInitialEntries = false;
          await setMetaValue(LAST_SYNC_META_KEY, Date.now());
          callbacks.onEntriesUpdated?.();
        }

        const summary = await getSyncSummary(false, null);
        callbacks.onStatusChanged?.(summary);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Gagal memproses pembaruan cerita realtime';
        callbacks.onError?.(msg);
      }
    },
    (err) => {
      const msg = err.message || 'Koneksi realtime cerita terputus';
      void getSyncSummary(false, msg).then((s) => callbacks.onStatusChanged?.(s));
      callbacks.onError?.(msg);
    }
  );

  const unsubStories = onSnapshot(
    collection(db, STORIES_COL),
    async (snapshot) => {
      try {
        let hasChanges = false;

        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            const remote = change.doc.data() as CreativeStory;
            const local = await getStoryById(remote.id);
            if (
              !local ||
              remote.updatedAt > local.updatedAt ||
              (remote.updatedAt === local.updatedAt && local.syncStatus !== 'synced')
            ) {
              await saveStoryLocal({ ...remote, syncStatus: 'synced' });
              hasChanges = true;
            }
          } else if (change.type === 'removed') {
            const local = await getStoryById(change.doc.id);
            if (local && !local.deleted) {
              await saveStoryLocal({ ...local, deleted: true, syncStatus: 'synced' });
              hasChanges = true;
            }
          }
        }

        if (hasChanges || isInitialStories) {
          isInitialStories = false;
          await setMetaValue(LAST_SYNC_META_KEY, Date.now());
          callbacks.onStoriesUpdated?.();
        }

        const summary = await getSyncSummary(false, null);
        callbacks.onStatusChanged?.(summary);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Gagal memproses pembaruan buku cerita realtime';
        callbacks.onError?.(msg);
      }
    },
    (err) => {
      const msg = err.message || 'Koneksi realtime buku cerita terputus';
      void getSyncSummary(false, msg).then((s) => callbacks.onStatusChanged?.(s));
      callbacks.onError?.(msg);
    }
  );

  return () => {
    unsubProfiles();
    unsubEntries();
    unsubStories();
  };
}

/**
 * Push-on-Save & Automatic Online Sync:
 * 1) Fetches remote profiles & entries first so a freshly opened device (like laptop)
 *    never overwrites newer cloud data with empty seed defaults.
 * 2) Pushes all local items that are newer than cloud (including compressed photos & voice notes).
 * 3) Merges newer remote items into IndexedDB for full offline availability.
 */
export async function syncWithCloud(): Promise<SyncStateSummary> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const db = getFirestoreInstance();
    if (!db) {
      return getSyncSummary(false, null);
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return getSyncSummary(false, null);
    }

    try {
      // 1. Fetch remote snapshots first
      const [remoteProfilesSnap, remoteEntriesSnap, remoteStoriesSnap] = await Promise.all([
        getDocs(collection(db, PROFILES_COL)),
        getDocs(collection(db, ENTRIES_COL)),
        getDocs(collection(db, STORIES_COL)),
      ]);

      const remoteProfileMap = new Map<string, ChildProfile>();
      for (const snap of remoteProfilesSnap.docs) {
        remoteProfileMap.set(snap.id, snap.data() as ChildProfile);
      }

      const remoteEntryMap = new Map<string, JournalEntry>();
      for (const snap of remoteEntriesSnap.docs) {
        remoteEntryMap.set(snap.id, snap.data() as JournalEntry);
      }

      const remoteStoryMap = new Map<string, CreativeStory>();
      for (const snap of remoteStoriesSnap.docs) {
        remoteStoryMap.set(snap.id, snap.data() as CreativeStory);
      }

      // 2. Push local profiles that are newer than cloud (or missing in cloud)
      const localProfiles = await getAllProfiles(true);
      const localProfileMap = new Map(localProfiles.map((p) => [p.id, p]));

      for (const profile of localProfiles) {
        const remote = remoteProfileMap.get(profile.id);
        if (remote && remote.updatedAt > profile.updatedAt) {
          // Remote is strictly newer; adopt remote
          await saveProfileLocal({ ...remote, syncStatus: 'synced' });
          continue;
        }
        if (
          profile.syncStatus !== 'synced' ||
          !remote ||
          profile.updatedAt > (remote?.updatedAt ?? 0)
        ) {
          const cleanProfile: ChildProfile = { ...profile, syncStatus: 'synced' };
          await setDoc(doc(db, PROFILES_COL, profile.id), stripUndefined(cleanProfile));
          await saveProfileLocal(cleanProfile);
        }
      }

      // Pull any remote-only profiles (e.g. 3rd child added on tablet)
      for (const [id, remote] of remoteProfileMap.entries()) {
        if (!localProfileMap.has(id)) {
          await saveProfileLocal({ ...remote, syncStatus: 'synced' });
        }
      }

      // 3. Push local entries that are newer than cloud (or missing in cloud)
      const localEntries = await getAllEntries(true);
      for (const entry of localEntries) {
        const remote = remoteEntryMap.get(entry.id);
        if (remote && remote.updatedAt > entry.updatedAt) {
          await saveEntryLocal({ ...remote, syncStatus: 'synced' });
          continue;
        }
        if (
          entry.syncStatus !== 'synced' ||
          !remote ||
          entry.updatedAt > (remote?.updatedAt ?? 0)
        ) {
          if (entry.deleted) {
            await setDoc(
              doc(db, ENTRIES_COL, entry.id),
              stripUndefined({
                ...entry,
                attachments: [],
                syncStatus: 'synced',
              })
            );
            for (const att of entry.attachments) {
              await deleteRemoteMedia(att.id);
            }
            await saveEntryLocal({ ...entry, attachments: [], syncStatus: 'synced' });
          } else {
            const currentIds = new Set(entry.attachments.map((a) => a.id));
            if (remote?.attachments) {
              for (const oldAtt of remote.attachments) {
                if (!currentIds.has(oldAtt.id)) {
                  await deleteRemoteMedia(oldAtt.id);
                }
              }
            }
            const syncedAttachments: MediaAttachment[] = [];
            for (const att of entry.attachments) {
              if (!att.remoteSynced) {
                const pushed = await pushMediaAttachment(entry.id, att);
                syncedAttachments.push(pushed);
              } else {
                syncedAttachments.push(att);
              }
            }
            const cleanEntry: JournalEntry = {
              ...entry,
              attachments: syncedAttachments,
              syncStatus: 'synced',
            };
            await setDoc(
              doc(db, ENTRIES_COL, entry.id),
              stripUndefined({
                ...cleanEntry,
                attachments: syncedAttachments.map(serializeAttachment),
              })
            );
            await saveEntryLocal(cleanEntry);
          }
        }
      }

      // 4. Pull any remote entries missing locally or newer on remote
      for (const remote of remoteEntryMap.values()) {
        const local = await getEntryById(remote.id);
        if (!local || remote.updatedAt > local.updatedAt) {
          await saveEntryLocal({ ...remote, syncStatus: 'synced' });
        }
      }

      // 5. Push local stories that are newer than cloud (or missing in cloud)
      const localStories = await getAllStories(true);
      for (const story of localStories) {
        const remote = remoteStoryMap.get(story.id);
        if (remote && remote.updatedAt > story.updatedAt) {
          await saveStoryLocal({ ...remote, syncStatus: 'synced' });
          continue;
        }
        if (
          story.syncStatus !== 'synced' ||
          !remote ||
          story.updatedAt > (remote?.updatedAt ?? 0)
        ) {
          const cleanStory: CreativeStory = { ...story, syncStatus: 'synced' };
          await setDoc(doc(db, STORIES_COL, story.id), stripUndefined(cleanStory));
          await saveStoryLocal(cleanStory);
        }
      }

      // 6. Pull any remote stories missing locally or newer on remote
      for (const remote of remoteStoryMap.values()) {
        const local = await getStoryById(remote.id);
        if (!local || remote.updatedAt > local.updatedAt) {
          await saveStoryLocal({ ...remote, syncStatus: 'synced' });
        }
      }

      await setMetaValue(LAST_SYNC_META_KEY, Date.now());
      return getSyncSummary(false, null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyinkronkan ke cloud. Data tetap aman tersimpan di perangkat ini.';
      return getSyncSummary(false, msg);
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}
