import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChildProfile, JournalEntry, SyncStateSummary } from './types';
import {
  deleteMediaBlobsByEntryLocal,
  ensureDefaultProfiles,
  getAllEntries,
  getAllProfiles,
  saveEntryLocal,
  saveProfileLocal,
} from './lib/db';
import { isFirebaseConfigured } from './lib/firebase';
import { getSyncSummary, subscribeToRealtimeSync, syncWithCloud } from './lib/sync';
import { ProfilePicker } from './components/ProfilePicker';
import { ProfileModal } from './components/ProfileModal';
import { JournalWorkspace } from './components/JournalWorkspace';
import { ExportWordModal } from './components/ExportWordModal';
import { ParentModeModal } from './components/ParentModeModal';

export function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const [parentMode, setParentMode] = useState(false);
  const [parentModalOpen, setParentModalOpen] = useState(false);

  const [profileModalTarget, setProfileModalTarget] = useState<{
    open: boolean;
    profile: ChildProfile | null;
  }>({ open: false, profile: null });
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [syncState, setSyncState] = useState<SyncStateSummary>({
    configured: isFirebaseConfigured(),
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  });

  const reloadLocalData = useCallback(async () => {
    const [loadedProfiles, loadedEntries] = await Promise.all([
      getAllProfiles(false),
      getAllEntries(false),
    ]);
    setProfiles(loadedProfiles);
    setEntries(loadedEntries);
  }, []);

  const runSync = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      const summary = await getSyncSummary(false, null);
      setSyncState(summary);
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const summary = await getSyncSummary(false, null);
      setSyncState(summary);
      return;
    }

    setSyncState((prev) => ({ ...prev, syncing: true, lastError: null }));
    const summary = await syncWithCloud();
    await reloadLocalData();
    setSyncState(summary);
  }, [reloadLocalData]);

  // Initial load from IndexedDB + realtime sync subscription + background cloud push
  useEffect(() => {
    let active = true;
    let unsubscribeRealtime: (() => void) | null = null;

    async function init() {
      try {
        await ensureDefaultProfiles();
        if (!active) return;
        await reloadLocalData();
        const initialSummary = await getSyncSummary(false, null);
        if (!active) return;
        setSyncState(initialSummary);
        setLoading(false);

        // Start listening to realtime Firestore updates immediately
        if (initialSummary.configured) {
          unsubscribeRealtime = subscribeToRealtimeSync({
            onProfilesUpdated: () => {
              if (active) void reloadLocalData();
            },
            onEntriesUpdated: () => {
              if (active) void reloadLocalData();
            },
            onStatusChanged: (summary) => {
              if (active) setSyncState(summary);
            },
          });
        }

        // Push any local pending entries (e.g. stories written on tablet while offline)
        // and fetch any missing items from the cloud
        if (initialSummary.configured && initialSummary.online) {
          await runSync();
        }
      } catch {
        if (!active) return;
        setLoadError('Gagal membuka penyimpanan lokal di browser ini. Coba muat ulang halaman.');
        setLoading(false);
      }
    }

    void init();
    return () => {
      active = false;
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
      }
    };
  }, [reloadLocalData, runSync]);

  // Automatically upload queued offline entries as soon as internet reconnects
  useEffect(() => {
    const handleOnline = () => {
      setSyncState((prev) => ({ ...prev, online: true }));
      void runSync();
    };
    const handleOffline = () => {
      setSyncState((prev) => ({ ...prev, online: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runSync]);

  const activeChild = useMemo(
    () => profiles.find((p) => p.id === activeChildId) ?? null,
    [profiles, activeChildId]
  );

  const activeChildEntries = useMemo(
    () =>
      entries
        .filter((e) => e.childId === activeChildId && !e.deleted)
        .sort((a, b) => {
          if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
          return b.createdAt - a.createdAt;
        }),
    [entries, activeChildId]
  );

  const entryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      if (!e.deleted) {
        map[e.childId] = (map[e.childId] ?? 0) + 1;
      }
    }
    return map;
  }, [entries]);

  function handleToggleParentMode() {
    if (parentMode) {
      setParentMode(false);
    } else {
      setParentModalOpen(true);
    }
  }

  async function handleSaveProfile(profile: ChildProfile) {
    const toSave: ChildProfile = {
      ...profile,
      syncStatus: isFirebaseConfigured() ? 'pending' : 'local-only',
    };
    await saveProfileLocal(toSave);
    await reloadLocalData();
    const summary = await getSyncSummary(false, null);
    setSyncState(summary);
    if (isFirebaseConfigured() && navigator.onLine) {
      void runSync();
    }
  }

  async function handleDeleteProfile(profile: ChildProfile) {
    if (!parentMode) return;
    const tombstone: ChildProfile = {
      ...profile,
      deleted: true,
      updatedAt: Date.now(),
      syncStatus: isFirebaseConfigured() ? 'pending' : 'local-only',
    };
    await saveProfileLocal(tombstone);
    if (activeChildId === profile.id) setActiveChildId(null);
    await reloadLocalData();
    const summary = await getSyncSummary(false, null);
    setSyncState(summary);
    if (isFirebaseConfigured() && navigator.onLine) {
      void runSync();
    }
  }

  async function handleSaveEntry(entry: JournalEntry) {
    const toSave: JournalEntry = {
      ...entry,
      syncStatus: isFirebaseConfigured() ? 'pending' : 'local-only',
    };
    await saveEntryLocal(toSave);
    await reloadLocalData();
    const summary = await getSyncSummary(false, null);
    setSyncState(summary);
    if (isFirebaseConfigured() && navigator.onLine) {
      await runSync();
    }
  }

  async function handleDeleteEntry(entry: JournalEntry) {
    if (!parentMode) return;
    const tombstone: JournalEntry = {
      ...entry,
      deleted: true,
      updatedAt: Date.now(),
      syncStatus: isFirebaseConfigured() ? 'pending' : 'local-only',
    };
    await saveEntryLocal(tombstone);
    await deleteMediaBlobsByEntryLocal(entry.id);
    await reloadLocalData();
    const summary = await getSyncSummary(false, null);
    setSyncState(summary);
    if (isFirebaseConfigured() && navigator.onLine) {
      void runSync();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="notebook-card rounded-2xl px-8 py-6 text-center space-y-2">
          <h1 className="font-display text-2xl font-bold text-ink">Buku Harian Ku</h1>
          <p className="text-sm font-semibold text-walnut">Membuka rak buku keluarga...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="notebook-card rounded-2xl p-7 max-w-md text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-danger">Terjadi Kendala</h1>
          <p className="text-sm font-semibold text-walnut">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold cursor-pointer"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!activeChild ? (
        <ProfilePicker
          profiles={profiles}
          entryCounts={entryCounts}
          parentMode={parentMode}
          syncState={syncState}
          onSelectChild={(id) => setActiveChildId(id)}
          onEditProfile={(profile) => setProfileModalTarget({ open: true, profile })}
          onAddProfile={() => setProfileModalTarget({ open: true, profile: null })}
          onToggleParentMode={handleToggleParentMode}
        />
      ) : (
        <JournalWorkspace
          key={activeChild.id}
          child={activeChild}
          entries={activeChildEntries}
          syncState={syncState}
          parentMode={parentMode}
          onSaveEntry={handleSaveEntry}
          onDeleteEntry={handleDeleteEntry}
          onSwitchAccount={() => setActiveChildId(null)}
          onEditProfile={() =>
            setProfileModalTarget({ open: true, profile: activeChild })
          }
          onOpenExport={() => setExportModalOpen(true)}
          onToggleParentMode={handleToggleParentMode}
        />
      )}

      {profileModalTarget.open && (
        <ProfileModal
          profile={profileModalTarget.profile}
          nextOrder={profiles.length + 1}
          parentMode={parentMode}
          canDelete={profiles.length > 1}
          onSave={handleSaveProfile}
          onDelete={parentMode ? handleDeleteProfile : undefined}
          onClose={() => setProfileModalTarget({ open: false, profile: null })}
        />
      )}

      {exportModalOpen && activeChild && (
        <ExportWordModal
          child={activeChild}
          entries={activeChildEntries}
          onClose={() => setExportModalOpen(false)}
        />
      )}

      {parentModalOpen && (
        <ParentModeModal
          onSuccess={() => setParentMode(true)}
          onClose={() => setParentModalOpen(false)}
        />
      )}
    </>
  );
}

export default App;
