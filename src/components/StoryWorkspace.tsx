import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AccentTone,
  ChildProfile,
  CreativeStory,
  MediaAttachment,
  StoryChapter,
  SyncStateSummary,
} from '../types';
import { compressImageBlob, createId } from '../lib/media';
import { deleteMediaBlobLocal, saveMediaBlobLocal } from '../lib/db';
import { formatDateLongID } from '../lib/date';
import { CameraModal } from './CameraModal';
import { MediaGallery } from './MediaPreview';
import { ExportStoryModal } from './ExportStoryModal';
import {
  BookCoverIcon,
  CameraLensIcon,
  CheckMarkIcon,
  GalleryPhotoIcon,
  LockShieldIcon,
  PlusMarkIcon,
  SwitchUsersIcon,
  TrashBinIcon,
  WordDocIcon,
} from './Icons';

interface StoryWorkspaceProps {
  child: ChildProfile;
  stories: CreativeStory[];
  syncState: SyncStateSummary;
  parentMode: boolean;
  onSaveStory: (story: CreativeStory) => Promise<void>;
  onDeleteStory: (story: CreativeStory) => Promise<void>;
  onSwitchAccount: () => void;
  onSwitchToJournal: () => void;
  onToggleParentMode: () => void;
}

const TONE_COLOR: Record<AccentTone, string> = {
  forest: '#2B6A58',
  terracotta: '#B34423',
  ochre: '#8C621C',
  slate: '#3B5568',
};

const TONE_LABEL: Record<AccentTone, string> = {
  forest: 'Hijau Daun',
  terracotta: 'Merah Bata',
  ochre: 'Kuning Kunyit',
  slate: 'Biru Danau',
};

function createInitialChapter(): StoryChapter {
  const now = Date.now();
  return {
    id: createId('bab'),
    title: 'Bab 1: Awal Mula',
    content: '',
    order: 1,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function StoryWorkspace({
  child,
  stories,
  syncState,
  parentMode,
  onSaveStory,
  onDeleteStory,
  onSwitchAccount,
  onSwitchToJournal,
  onToggleParentMode,
}: StoryWorkspaceProps) {
  const childStories = useMemo(
    () =>
      stories
        .filter((s) => s.childId === child.id && !s.deleted)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [stories, child.id]
  );

  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(
    () => childStories[0]?.id ?? null
  );

  // Active breakdown tab: 'synopsis' or 'chapter'
  const [activeTab, setActiveTab] = useState<'synopsis' | 'chapter'>('chapter');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // Draft form states
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [coverTone, setCoverTone] = useState<AccentTone>(child.accentTone);
  const [chapters, setChapters] = useState<StoryChapter[]>([]);

  // Camera & Gallery states
  const MAX_CHAPTER_PHOTOS = 5;
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Original states for dirty tracking
  const originalStateRef = useRef<{
    title: string;
    synopsis: string;
    coverTone: AccentTone;
    chapters: StoryChapter[];
  }>({
    title: '',
    synopsis: '',
    coverTone: child.accentTone,
    chapters: [],
  });

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteStory, setConfirmDeleteStory] = useState(false);
  const [pendingSwitchAction, setPendingSwitchAction] = useState<(() => void) | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const activeStory = useMemo(
    () => childStories.find((s) => s.id === selectedStoryId) ?? null,
    [childStories, selectedStoryId]
  );

  // Check if current draft has unsaved changes
  const isDirty = useMemo(() => {
    if (!selectedStoryId) return false;
    const orig = originalStateRef.current;
    if (title !== orig.title) return true;
    if (synopsis !== orig.synopsis) return true;
    if (coverTone !== orig.coverTone) return true;
    if (chapters.length !== orig.chapters.length) return true;
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      const oc = orig.chapters[i];
      if (
        !oc ||
        c.title !== oc.title ||
        c.content !== oc.content ||
        (c.attachments?.length || 0) !== (oc.attachments?.length || 0)
      ) {
        return true;
      }
    }
    return false;
  }, [selectedStoryId, title, synopsis, coverTone, chapters]);

  // Load active story into draft state
  useEffect(() => {
    if (activeStory) {
      setTitle(activeStory.title);
      setSynopsis(activeStory.synopsis || '');
      setCoverTone(activeStory.coverTone || child.accentTone);
      const chaps =
        activeStory.chapters && activeStory.chapters.length > 0
          ? activeStory.chapters
          : [createInitialChapter()];
      setChapters(chaps);
      setSelectedChapterId((prev) =>
        prev && chaps.some((c) => c.id === prev) ? prev : chaps[0]?.id ?? null
      );
      originalStateRef.current = {
        title: activeStory.title,
        synopsis: activeStory.synopsis || '',
        coverTone: activeStory.coverTone || child.accentTone,
        chapters: JSON.parse(JSON.stringify(chaps)),
      };
      setSavedNotice(null);
      setError(null);
      setConfirmDeleteStory(false);
    } else {
      setTitle('');
      setSynopsis('');
      setChapters([]);
      setSelectedChapterId(null);
      originalStateRef.current = {
        title: '',
        synopsis: '',
        coverTone: child.accentTone,
        chapters: [],
      };
    }
  }, [activeStory, child.accentTone]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (selectedStoryId && !saving) {
          void handleSaveCurrentStory();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === selectedChapterId) ?? chapters[0] ?? null,
    [chapters, selectedChapterId]
  );

  const activeChapterPhotos = useMemo(() => {
    return activeChapter?.attachments?.filter((a) => a.type === 'photo') || [];
  }, [activeChapter?.attachments]);

  function executeWithDirtyCheck(action: () => void) {
    if (isDirty) {
      setPendingSwitchAction(() => action);
      return;
    }
    action();
  }

  function handleCreateNewStory() {
    executeWithDirtyCheck(() => {
      const now = Date.now();
      const initialChap = createInitialChapter();
      const newStory: CreativeStory = {
        id: createId('buku'),
        childId: child.id,
        title: 'Buku Cerita Baru',
        synopsis: '',
        coverTone: child.accentTone,
        chapters: [initialChap],
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending',
      };
      void onSaveStory(newStory);
      setSelectedStoryId(newStory.id);
      setActiveTab('chapter');
      setSelectedChapterId(initialChap.id);
    });
  }

  function handleSelectStory(storyId: string) {
    if (storyId === selectedStoryId) return;
    executeWithDirtyCheck(() => {
      setSelectedStoryId(storyId);
      setActiveTab('chapter');
    });
  }

  function handleAddChapter() {
    const nextOrder = chapters.length + 1;
    const newChap: StoryChapter = {
      id: createId('bab'),
      title: `Bab ${nextOrder}: Judul Bab`,
      content: '',
      order: nextOrder,
      attachments: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChapters((prev) => [...prev, newChap]);
    setSelectedChapterId(newChap.id);
    setActiveTab('chapter');
    setSavedNotice(null);
  }

  function handleUpdateActiveChapterTitle(newTitle: string) {
    if (!activeChapter) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapter.id ? { ...c, title: newTitle } : c))
    );
    setSavedNotice(null);
  }

  function handleUpdateActiveChapterContent(newContent: string) {
    if (!activeChapter) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapter.id ? { ...c, content: newContent } : c))
    );
    setSavedNotice(null);
  }

  function handleDeleteChapter(chapterId: string) {
    if (chapters.length <= 1) {
      setError('Buku cerita minimal harus memiliki 1 bab.');
      return;
    }
    const remaining = chapters
      .filter((c) => c.id !== chapterId)
      .map((c, idx) => ({ ...c, order: idx + 1 }));
    setChapters(remaining);
    setSelectedChapterId(remaining[0]?.id ?? null);
    setSavedNotice(null);
  }

  async function addChapterPhotoBlob(rawBlob: Blob) {
    if (!activeChapter) return;
    const currentCount = activeChapter.attachments?.filter((a) => a.type === 'photo').length || 0;
    if (currentCount >= MAX_CHAPTER_PHOTOS) {
      setError(`Maksimal ${MAX_CHAPTER_PHOTOS} foto tiap bab.`);
      return;
    }
    setError(null);
    try {
      const compressed = await compressImageBlob(rawBlob, 720, 0.65);
      const id = createId('foto');
      await saveMediaBlobLocal(id, activeChapter.id, compressed);
      const att: MediaAttachment = {
        id,
        type: 'photo',
        mimeType: compressed.type || 'image/webp',
        remoteSynced: false,
        createdAt: Date.now(),
      };
      setChapters((prev) =>
        prev.map((c) =>
          c.id === activeChapter.id
            ? { ...c, attachments: [...(c.attachments || []), att] }
            : c
        )
      );
      setSavedNotice(null);
    } catch {
      setError('Foto gagal ditambahkan. Coba pilih gambar lain.');
    }
  }

  async function handleChapterGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeChapter) return;
    const files = Array.from(e.target.files ?? []);
    const currentCount = activeChapter.attachments?.filter((a) => a.type === 'photo').length || 0;
    const remainingSlots = MAX_CHAPTER_PHOTOS - currentCount;

    if (remainingSlots <= 0) {
      setError(`Maksimal ${MAX_CHAPTER_PHOTOS} foto tiap bab.`);
      e.target.value = '';
      return;
    }

    const toAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(`Hanya ${remainingSlots} foto yang ditambahkan karena batas maksimal ${MAX_CHAPTER_PHOTOS} foto.`);
    }

    for (const file of toAdd) {
      await addChapterPhotoBlob(file);
    }
    e.target.value = '';
  }

  async function handleRemoveChapterAttachment(attId: string) {
    if (!parentMode || !activeChapter) return;
    setChapters((prev) =>
      prev.map((c) =>
        c.id === activeChapter.id
          ? {
              ...c,
              attachments: (c.attachments || []).filter((a) => a.id !== attId),
            }
          : c
      )
    );
    try {
      await deleteMediaBlobLocal(attId);
    } catch {
      // ignore
    }
    setSavedNotice(null);
  }

  async function handleSaveCurrentStory(): Promise<void> {
    if (!selectedStoryId) return;
    setSaving(true);
    setError(null);
    const now = Date.now();

    const cleanTitle = title.trim() || 'Tanpa Judul';

    const updated: CreativeStory = {
      id: selectedStoryId,
      childId: child.id,
      title: cleanTitle,
      synopsis: synopsis.trim(),
      coverTone,
      chapters: chapters.map((c) => ({
        ...c,
        title: c.title.trim() || `Bab ${c.order}`,
        attachments: c.attachments || [],
        updatedAt: now,
      })),
      createdAt: activeStory?.createdAt ?? now,
      updatedAt: now,
      deleted: false,
      syncStatus: 'pending',
    };

    try {
      await onSaveStory(updated);
      originalStateRef.current = {
        title: updated.title,
        synopsis: updated.synopsis,
        coverTone: updated.coverTone,
        chapters: JSON.parse(JSON.stringify(updated.chapters)),
      };
      setSavedNotice('Buku ceritamu sudah tersimpan.');
    } catch {
      setError('Gagal menyimpan cerita. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStory() {
    if (!parentMode || !activeStory) return;
    setSaving(true);
    try {
      const tombstone: CreativeStory = {
        ...activeStory,
        deleted: true,
        updatedAt: Date.now(),
        syncStatus: 'pending',
      };
      await onDeleteStory(tombstone);
      const remaining = childStories.filter((s) => s.id !== activeStory.id);
      setSelectedStoryId(remaining[0]?.id ?? null);
    } catch {
      setError('Gagal menghapus buku cerita.');
    } finally {
      setSaving(false);
      setConfirmDeleteStory(false);
    }
  }

  const isRealtime = syncState.configured && syncState.online && !syncState.syncing;
  const quietSyncText = !syncState.configured
    ? 'Tersimpan di perangkat'
    : !syncState.online
      ? syncState.pendingCount > 0
        ? `Offline (${syncState.pendingCount} data menunggu internet)`
        : 'Offline (tersimpan aman di perangkat)'
      : syncState.syncing
        ? 'Menyelaraskan ke cloud...'
        : 'Tersinkron realtime ke cloud';

  // Words and character counts of active chapter
  const chapterWordCount = useMemo(() => {
    if (!activeChapter?.content) return 0;
    return activeChapter.content.trim().split(/\s+/).filter(Boolean).length;
  }, [activeChapter?.content]);

  const chapterCharCount = activeChapter?.content?.length ?? 0;

  return (
    <div className="min-h-screen bg-cream flex flex-row">
      {/* LEFT SIDEBAR: List of Stories */}
      <aside className="w-[270px] lg:w-[300px] shrink-0 bg-parchment border-r border-rule flex flex-col h-screen sticky top-0">
        {/* Header Branding & Profile */}
        <div className="p-4 border-b border-rule space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-forest min-w-0">
              <span className="text-xl">📖</span>
              <span className="font-display text-[15px] font-bold text-ink whitespace-nowrap">
                Buku Cerita Ku
              </span>
            </div>
            <button
              type="button"
              onClick={() => executeWithDirtyCheck(onSwitchAccount)}
              className="px-2.5 py-1.5 min-h-[36px] rounded-lg border border-rule-strong bg-paper text-ink text-xs font-bold hover:bg-cream flex items-center gap-1.5 cursor-pointer"
              title="Ganti akun anak"
            >
              <SwitchUsersIcon className="w-3.5 h-3.5" />
              <span>Ganti</span>
            </button>
          </div>

          {/* Active Author Info Card */}
          <div className="rounded-xl bg-paper border border-rule p-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-white font-display text-base font-bold border border-rule"
              style={{
                backgroundColor: child.avatarDataUrl ? '#FFFDF8' : TONE_COLOR[child.accentTone],
              }}
            >
              {child.avatarDataUrl ? (
                <img
                  src={child.avatarDataUrl}
                  alt={`Foto ${child.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                child.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-bold text-ink truncate">
                {child.name}
              </div>
              <div className="text-[11px] font-semibold text-walnut">
                Penulis Cerita &amp; Cerpen
              </div>
            </div>
          </div>

          {/* Switch to Journal Button */}
          <button
            type="button"
            onClick={() => executeWithDirtyCheck(onSwitchToJournal)}
            className="w-full py-2 px-3 min-h-[38px] rounded-xl border border-rule-strong bg-paper hover:bg-cream text-ink text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookCoverIcon className="w-3.5 h-3.5 text-forest" />
            <span>Buka Buku Harian</span>
          </button>

          {/* New Story Action Button */}
          <button
            type="button"
            onClick={handleCreateNewStory}
            className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-forest text-white text-sm font-extrabold hover:bg-forest-hover flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <PlusMarkIcon className="w-4 h-4" />
            <span>Tulis Cerita Baru</span>
          </button>
        </div>

        {/* Stories Shelf (List of drafts) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-walnut">
            Daftar Ceritamu ({childStories.length})
          </div>

          {childStories.length === 0 ? (
            <div className="p-4 text-center text-xs font-semibold text-walnut space-y-2">
              <p>Belum ada buku cerita.</p>
              <p className="text-[11px]">Klik tombol di atas untuk membuat cerpen atau novel pertamamu!</p>
            </div>
          ) : (
            childStories.map((story) => {
              const isSelected = story.id === selectedStoryId;
              const storyColor = TONE_COLOR[story.coverTone] ?? '#2B6A58';
              const chapterCount = story.chapters?.length || 1;

              return (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => handleSelectStory(story.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-paper border-forest ring-1 ring-forest/40 shadow-xs'
                      : 'bg-paper/70 border-rule hover:bg-paper'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: storyColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-bold text-ink truncate">
                      {story.title || 'Tanpa Judul'}
                    </div>
                    <div className="text-[11px] font-semibold text-walnut flex items-center gap-2 mt-0.5">
                      <span>{chapterCount} Bab</span>
                      <span>•</span>
                      <span>{formatDateLongID(story.updatedAt ? new Date(story.updatedAt).toISOString().split('T')[0] : '')}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom Utility Bar */}
        <div className="p-4 border-t border-rule space-y-2 bg-paper/50">
          {activeStory && (
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="w-full py-2 px-3 min-h-[38px] rounded-xl border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-paper flex items-center justify-center gap-2 cursor-pointer"
            >
              <WordDocIcon className="w-4 h-4 text-forest" />
              <span>Export Buku (Word &amp; PDF)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleParentMode}
            className={`w-full py-2 px-3 min-h-[38px] rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
              parentMode
                ? 'bg-terracotta text-white border-terracotta'
                : 'border-rule bg-paper text-walnut hover:border-rule-strong'
            }`}
          >
            <LockShieldIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{parentMode ? 'Mode Orang Tua Aktif (Kunci)' : 'Mode Orang Tua'}</span>
          </button>

          <p className="text-[11px] font-bold text-walnut text-center pt-0.5 flex items-center justify-center gap-1.5">
            {isRealtime && (
              <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0 animate-pulse" />
            )}
            <span>{quietSyncText}</span>
          </p>
        </div>
      </aside>

      {/* RIGHT FOCUSED WORKSPACE */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        {!activeStory ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-parchment border border-rule-strong text-forest flex items-center justify-center text-3xl">
              📚
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="font-display text-xl font-bold text-ink">
                Mulai Mengarang Cerita
              </h2>
              <p className="text-sm font-semibold text-walnut leading-relaxed">
                Di sini kamu bisa menulis dongeng, cerita seru, cerpen, atau novel bersambung tanpa terikat tanggal.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateNewStory}
              className="px-6 py-3 min-h-[46px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <PlusMarkIcon className="w-4 h-4" />
              <span>Buat Buku Cerita Baru</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Top Breadcrumb Bar */}
            <header className="px-6 sm:px-8 py-3.5 bg-paper border-b border-rule flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
              <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-bold min-w-0">
                <span className="text-walnut">Buku Cerita</span>
                <span className="text-rule-strong">/</span>
                <span className="text-ink truncate max-w-[200px] sm:max-w-xs">
                  {title || 'Tanpa Judul'}
                </span>
                <span className="text-rule-strong">/</span>
                <span className="text-forest">
                  {activeTab === 'synopsis' ? 'Sinopsis & Sampul' : activeChapter?.title || 'Bab Cerita'}
                </span>
              </nav>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                    Ada perubahan belum disimpan
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowExportModal(true)}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-paper flex items-center gap-1.5 cursor-pointer"
                  title="Export buku cerita ke Word atau PDF"
                >
                  <WordDocIcon className="w-4 h-4 text-forest" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentStory}
                  disabled={saving}
                  className="px-5 py-2 min-h-[40px] rounded-xl bg-forest text-white text-xs sm:text-sm font-extrabold hover:bg-forest-hover disabled:opacity-45 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckMarkIcon className="w-4 h-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </header>

            {/* Breakdown Menu / Tab Selector */}
            <div className="px-6 sm:px-8 pt-4 pb-2 border-b border-rule bg-parchment/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('synopsis')}
                  className={`px-4 py-2 min-h-[38px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'synopsis'
                      ? 'bg-paper text-forest border border-rule-strong shadow-xs'
                      : 'text-walnut hover:text-ink'
                  }`}
                >
                  <span>📋 Sinopsis &amp; Sampul</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chapter')}
                  className={`px-4 py-2 min-h-[38px] rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'chapter'
                      ? 'bg-paper text-forest border border-rule-strong shadow-xs'
                      : 'text-walnut hover:text-ink'
                  }`}
                >
                  <span>📖 Bab Cerita ({chapters.length})</span>
                </button>
              </div>

              {activeTab === 'chapter' && (
                <button
                  type="button"
                  onClick={handleAddChapter}
                  className="px-3.5 py-1.5 min-h-[36px] rounded-xl border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-paper flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusMarkIcon className="w-3.5 h-3.5 text-forest" />
                  <span>Tambah Bab Baru</span>
                </button>
              )}
            </div>

            {/* Sub-menu Chapters Bar (when activeTab === 'chapter') */}
            {activeTab === 'chapter' && (
              <div className="px-6 sm:px-8 py-2.5 border-b border-rule bg-paper overflow-x-auto flex items-center gap-2">
                {chapters.map((chap) => {
                  const isCurrent = chap.id === activeChapter?.id;
                  return (
                    <button
                      key={chap.id}
                      type="button"
                      onClick={() => setSelectedChapterId(chap.id)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-forest text-white border-forest'
                          : 'bg-parchment text-ink border-rule hover:bg-cream'
                      }`}
                    >
                      <span>{chap.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Writing Content Sheet */}
            <div className="flex-1 p-6 sm:p-8 max-w-4xl w-full mx-auto flex flex-col gap-5">
              {/* Feedback messages */}
              {error && (
                <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-danger text-danger text-sm font-bold">
                  {error}
                </div>
              )}
              {savedNotice && (
                <div className="p-3.5 rounded-xl bg-[#EAF4F0] border border-forest text-forest text-sm font-bold flex items-center gap-2">
                  <CheckMarkIcon className="w-4 h-4 shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}

              {/* TAB 1: SYNOPSIS & COVER */}
              {activeTab === 'synopsis' && (
                <div className="notebook-card rounded-2xl p-6 sm:p-8 space-y-6">
                  {/* Book Title */}
                  <label className="block space-y-2">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                      Judul Buku / Cerita
                    </span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setSavedNotice(null);
                      }}
                      placeholder="Masukkan judul cerita (misal: Petualangan Kucing Ajaib)..."
                      className="w-full px-4 py-3 min-h-[48px] rounded-xl border border-rule-strong bg-paper text-ink font-display text-xl sm:text-2xl font-bold focus:outline-forest"
                    />
                  </label>

                  {/* Cover Tone Selector */}
                  <div className="space-y-2">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                      Warna Sampul Buku
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      {(['forest', 'terracotta', 'ochre', 'slate'] as AccentTone[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setCoverTone(t);
                            setSavedNotice(null);
                          }}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                            coverTone === t
                              ? 'border-ink bg-paper shadow-xs ring-1 ring-ink'
                              : 'border-rule bg-parchment hover:bg-paper'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: TONE_COLOR[t] }}
                          />
                          <span>{TONE_LABEL[t]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Synopsis Textarea */}
                  <label className="block space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                        Sinopsis Cerita
                      </span>
                      <span className="text-xs font-semibold text-walnut">
                        Ringkasan alur cerita
                      </span>
                    </div>
                    <textarea
                      value={synopsis}
                      onChange={(e) => {
                        setSynopsis(e.target.value);
                        setSavedNotice(null);
                      }}
                      rows={8}
                      placeholder="Ceritakan gambaran besar ceritamu... Siapa tokoh utamanya? Apa petualangan seru yang mereka hadapi?"
                      className="w-full p-4 rounded-xl border border-rule-strong bg-paper text-ink text-base font-semibold leading-relaxed placeholder:text-walnut/50 resize-y focus:outline-forest"
                    />
                  </label>
                </div>
              )}

              {/* TAB 2: CHAPTER EDITOR */}
              {activeTab === 'chapter' && activeChapter && (
                <div className="notebook-card rounded-2xl overflow-hidden flex flex-col flex-1">
                  {/* Chapter Header */}
                  <div className="p-5 sm:p-6 border-b border-rule bg-paper space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex-1 min-w-[240px]">
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-walnut block mb-1">
                          Nama / Judul Bab Ini
                        </span>
                        <input
                          type="text"
                          value={activeChapter.title}
                          onChange={(e) => handleUpdateActiveChapterTitle(e.target.value)}
                          placeholder="Beri nama bab ini..."
                          className="w-full px-3.5 py-2 rounded-xl border border-rule-strong bg-cream text-ink font-display text-lg font-bold focus:outline-forest"
                        />
                      </label>

                      {chapters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteChapter(activeChapter.id)}
                          className="px-3 py-2 min-h-[38px] rounded-xl border border-rule bg-paper text-danger text-xs font-bold hover:bg-[#FDF2F2] flex items-center gap-1.5 cursor-pointer self-end"
                        >
                          <TrashBinIcon className="w-3.5 h-3.5" />
                          <span>Hapus Bab Ini</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chapter Body Writing Sheet */}
                  <div className="p-5 sm:p-7 flex-1 flex flex-col">
                    <textarea
                      value={activeChapter.content}
                      onChange={(e) => handleUpdateActiveChapterContent(e.target.value)}
                      rows={14}
                      placeholder="Mulai menulis cerita untuk bab ini... Ketik kata demi kata, nikmati petualanganmu!"
                      aria-label="Isi cerita bab"
                      className="diary-lined-paper w-full flex-1 min-h-[360px] bg-transparent text-ink text-base sm:text-[18px] font-semibold leading-relaxed placeholder:text-walnut/50 resize-y focus:outline-none"
                    />

                    {/* Attached Photos in Chapter */}
                    {activeChapter.attachments && activeChapter.attachments.length > 0 && (
                      <div className="pt-3 border-t border-rule space-y-2">
                        <div className="text-xs font-extrabold uppercase tracking-wide text-walnut flex items-center justify-between">
                          <span>Foto / Gambar Bab Ini ({activeChapter.attachments.length})</span>
                          <span className="text-[11px] font-semibold text-walnut">
                            {activeChapterPhotos.length}/{MAX_CHAPTER_PHOTOS} Foto
                          </span>
                        </div>
                        <MediaGallery
                          attachments={activeChapter.attachments}
                          editable={parentMode}
                          onRemove={parentMode ? handleRemoveChapterAttachment : undefined}
                        />
                      </div>
                    )}

                    {/* Media Buttons Row for Chapter */}
                    <div className="pt-3 border-t border-rule flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={activeChapterPhotos.length >= MAX_CHAPTER_PHOTOS}
                        className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-parchment disabled:opacity-45 flex items-center gap-2 cursor-pointer"
                        title={
                          activeChapterPhotos.length >= MAX_CHAPTER_PHOTOS
                            ? `Maksimal ${MAX_CHAPTER_PHOTOS} foto per bab`
                            : 'Tambah foto dari galeri'
                        }
                      >
                        <GalleryPhotoIcon className="w-4 h-4 text-forest" />
                        <span>
                          {activeChapterPhotos.length >= MAX_CHAPTER_PHOTOS
                            ? `Foto Penuh (${activeChapterPhotos.length}/${MAX_CHAPTER_PHOTOS})`
                            : `Tambah Foto Galeri (${activeChapterPhotos.length}/${MAX_CHAPTER_PHOTOS})`}
                        </span>
                      </button>
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleChapterGalleryChange}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (activeChapterPhotos.length >= MAX_CHAPTER_PHOTOS) {
                            setError(`Maksimal ${MAX_CHAPTER_PHOTOS} foto tiap bab.`);
                            return;
                          }
                          setShowCamera(true);
                        }}
                        disabled={activeChapterPhotos.length >= MAX_CHAPTER_PHOTOS}
                        className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-parchment disabled:opacity-45 flex items-center gap-2 cursor-pointer"
                      >
                        <CameraLensIcon className="w-4 h-4 text-forest" />
                        <span>Kamera Selfie</span>
                      </button>
                    </div>

                    {/* Word and Character Count Helper */}
                    <div className="pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-walnut">
                      <span>
                        {chapterWordCount} kata • {chapterCharCount} karakter
                      </span>
                      <span>Tips: Tekan Ctrl + S untuk menyimpan ceritamu kapan saja.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Parent Mode: Delete Entire Story */}
              {parentMode && (
                <div className="pt-2">
                  {!confirmDeleteStory ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteStory(true)}
                      className="px-4 py-2 min-h-[40px] rounded-xl border border-danger/40 bg-white text-danger text-xs font-bold hover:bg-[#FDF2F2] flex items-center gap-1.5 cursor-pointer"
                    >
                      <TrashBinIcon className="w-4 h-4" />
                      <span>Hapus Seluruh Buku Cerita Ini (Mode Orang Tua)</span>
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#FDF2F2] border border-danger flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-bold text-danger">
                        Yakin ingin menghapus seluruh buku cerita "{title}"?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteStory(false)}
                          className="px-3.5 py-2 min-h-[38px] rounded-lg border border-rule bg-paper text-ink text-xs font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteStory}
                          disabled={saving}
                          className="px-4 py-2 min-h-[38px] rounded-lg bg-danger text-white text-xs font-bold cursor-pointer"
                        >
                          Ya, Hapus Buku
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Camera Selfie Modal */}
      {showCamera && (
        <CameraModal
          title="Ambil Foto untuk Bab Cerita"
          onCapture={(blob) => {
            setShowCamera(false);
            void addChapterPhotoBlob(blob);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {pendingSwitchAction && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="notebook-card rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-rule-strong">
            <h3 className="font-display text-lg font-bold text-ink">
              Cerita Belum Disimpan
            </h3>
            <p className="text-sm font-semibold text-walnut leading-relaxed">
              Ada tulisan atau bab yang belum kamu simpan. Apakah kamu yakin ingin berpindah halaman tanpa menyimpan? Tulisan yang belum disimpan akan hilang.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingSwitchAction(null)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-rule-strong bg-paper text-ink text-xs sm:text-sm font-bold hover:bg-cream cursor-pointer"
              >
                Tetap Menulis
              </button>
              <button
                type="button"
                onClick={() => {
                  const act = pendingSwitchAction;
                  setPendingSwitchAction(null);
                  act?.();
                }}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-danger/40 bg-white text-danger text-xs sm:text-sm font-bold hover:bg-[#FDF2F2] cursor-pointer"
              >
                Buang Perubahan
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveCurrentStory();
                  const act = pendingSwitchAction;
                  setPendingSwitchAction(null);
                  act?.();
                }}
                disabled={saving}
                className="px-5 py-2.5 min-h-[42px] rounded-xl bg-forest text-white text-xs sm:text-sm font-bold hover:bg-forest-hover cursor-pointer"
              >
                Simpan &amp; Lanjut
              </button>
            </div>
          </div>
        </div>
      )}
      {showExportModal && activeStory && (
        <ExportStoryModal
          story={activeStory}
          author={child}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
