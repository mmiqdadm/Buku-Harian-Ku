import { useMemo, useState } from 'react';
import type { AccentTone, ChildProfile, JournalEntry, SyncStateSummary } from '../types';
import {
  formatDateLongID,
  formatMonthYearID,
  getCurrentMonthKey,
  getTodayDateKey,
  splitMonthKeyID,
} from '../lib/date';
import { JournalEditor } from './JournalEditor';
import { MediaGallery } from './MediaPreview';
import {
  BookCoverIcon,
  FolderMonthIcon,
  LockShieldIcon,
  PencilNibIcon,
  PlusMarkIcon,
  SearchGlassIcon,
  SwitchUsersIcon,
  TrashBinIcon,
  WordDocIcon,
} from './Icons';

interface JournalWorkspaceProps {
  child: ChildProfile;
  entries: JournalEntry[];
  syncState: SyncStateSummary;
  parentMode: boolean;
  onSaveEntry: (entry: JournalEntry) => Promise<void>;
  onDeleteEntry: (entry: JournalEntry) => Promise<void>;
  onSwitchAccount: () => void;
  onEditProfile: () => void;
  onOpenExport: () => void;
  onToggleParentMode: () => void;
}

const TONE_COLOR: Record<AccentTone, string> = {
  forest: '#2B6A58',
  terracotta: '#B34423',
  ochre: '#8C621C',
  slate: '#3B5568',
};

export function JournalWorkspace({
  child,
  entries,
  syncState,
  parentMode,
  onSaveEntry,
  onDeleteEntry,
  onSwitchAccount,
  onEditProfile,
  onOpenExport,
  onToggleParentMode,
}: JournalWorkspaceProps) {
  const todayKey = getTodayDateKey();
  const currentMonthKey = getCurrentMonthKey();

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthFolders = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set(currentMonthKey, 0);
    for (const e of entries) {
      counts.set(e.monthKey, (counts.get(e.monthKey) ?? 0) + 1);
    }

    const sortedKeys = Array.from(counts.keys()).sort((a, b) => b.localeCompare(a));
    const groupedByYear = new Map<string, { monthKey: string; label: string; count: number }[]>();

    for (const key of sortedKeys) {
      const { year, monthName } = splitMonthKeyID(key);
      const list = groupedByYear.get(year) ?? [];
      list.push({ monthKey: key, label: monthName, count: counts.get(key) ?? 0 });
      groupedByYear.set(year, list);
    }

    return Array.from(groupedByYear.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries, currentMonthKey]);

  const todayEntries = useMemo(
    () => entries.filter((e) => e.dateKey === todayKey),
    [entries, todayKey]
  );

  const trimmedSearch = searchQuery.trim().toLowerCase();

  const visibleEntries = useMemo(() => {
    if (trimmedSearch) {
      return entries.filter((e) => {
        const longDate = formatDateLongID(e.dateKey).toLowerCase();
        return (
          e.content.toLowerCase().includes(trimmedSearch) ||
          e.title.toLowerCase().includes(trimmedSearch) ||
          longDate.includes(trimmedSearch) ||
          e.dateKey.includes(trimmedSearch)
        );
      });
    }
    if (selectedMonth === 'ALL') return entries;
    return entries.filter((e) => e.monthKey === selectedMonth);
  }, [entries, selectedMonth, trimmedSearch]);

  function openNewToday() {
    setSelectedMonth(currentMonthKey);
    setSearchQuery('');
    setEditingEntry(null);
    setViewMode('editor');
  }

  function openEditEntry(entry: JournalEntry) {
    setEditingEntry(entry);
    setViewMode('editor');
  }

  async function handleSaveAndStay(saved: JournalEntry) {
    await onSaveEntry(saved);
    setEditingEntry(saved);
    setSelectedMonth(saved.monthKey);
  }

  async function handleDeleteFromEditor(entry: JournalEntry) {
    if (!parentMode) return;
    await onDeleteEntry(entry);
    setEditingEntry(null);
    setViewMode('list');
  }

  async function handleQuickDelete(entry: JournalEntry) {
    if (!parentMode) return;
    await onDeleteEntry(entry);
    setDeletingId(null);
  }

  const coverColor = TONE_COLOR[child.accentTone] ?? '#2B6A58';
  const initials = child.name.slice(0, 2).toUpperCase();
  const activeMonthParts =
    selectedMonth === 'ALL' ? null : splitMonthKeyID(selectedMonth);

  const isRealtime =
    syncState.configured && syncState.online && !syncState.syncing;

  const quietSyncText = !syncState.configured
    ? 'Tersimpan di perangkat'
    : !syncState.online
      ? syncState.pendingCount > 0
        ? `Offline (${syncState.pendingCount} cerita menunggu internet)`
        : 'Offline (tersimpan aman di perangkat)'
      : syncState.syncing
        ? 'Menyelaraskan ke cloud...'
        : 'Tersinkron realtime ke cloud';

  return (
    <div className="min-h-screen bg-cream flex flex-row">
      {/* LEFT SIDEBAR */}
      <aside className="w-[260px] lg:w-[290px] shrink-0 bg-parchment border-r border-rule flex flex-col h-screen sticky top-0">
        {/* Brand & Child Profile Header */}
        <div className="p-4 border-b border-rule space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-forest min-w-0">
              <BookCoverIcon className="w-5 h-5 shrink-0" />
              <span className="font-display text-[15px] font-bold text-ink whitespace-nowrap">
                Buku Harian Ku
              </span>
            </div>
            <button
              type="button"
              onClick={onSwitchAccount}
              className="px-2.5 py-1.5 min-h-[36px] rounded-lg border border-rule-strong bg-paper text-ink text-xs font-bold hover:bg-cream flex items-center gap-1.5 cursor-pointer"
              title="Ganti akun anak"
            >
              <SwitchUsersIcon className="w-3.5 h-3.5" />
              <span>Ganti</span>
            </button>
          </div>

          <div className="rounded-xl bg-paper border border-rule p-3 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-white font-display text-base font-bold border border-rule"
              style={{
                backgroundColor: child.avatarDataUrl ? '#FFFDF8' : coverColor,
              }}
            >
              {child.avatarDataUrl ? (
                <img
                  src={child.avatarDataUrl}
                  alt={`Foto ${child.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-bold text-ink truncate">
                {child.name}
              </div>
              <button
                type="button"
                onClick={onEditProfile}
                className="text-xs font-bold text-forest hover:underline cursor-pointer"
              >
                Lihat &amp; Edit Biodata
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewToday}
            className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-terracotta text-white text-sm font-extrabold hover:bg-terracotta-hover flex items-center justify-center gap-2 cursor-pointer"
          >
            <PlusMarkIcon className="w-4 h-4" />
            <span>Tulis Cerita Hari Ini</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 pt-3.5 pb-2">
          <div className="relative">
            <SearchGlassIcon className="w-4 h-4 text-walnut absolute left-3 top-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (viewMode === 'editor') setViewMode('list');
              }}
              placeholder={`Cari cerita ${child.nickname || child.name}...`}
              aria-label="Cari cerita"
              className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-xl border border-rule-strong bg-paper text-ink text-xs font-bold placeholder:text-walnut/70"
            />
          </div>
        </div>

        {/* Monthly Folders Tree */}
        <nav
          aria-label="Folder Bulanan"
          className="flex-1 overflow-y-auto warm-scroll px-3 py-2 space-y-4"
        >
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedMonth('ALL');
                setSearchQuery('');
                setViewMode('list');
              }}
              className={`w-full text-left px-3 py-2.5 min-h-[42px] rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                selectedMonth === 'ALL' && !trimmedSearch && viewMode === 'list'
                  ? 'bg-forest text-white'
                  : 'text-ink hover:bg-cream/80'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderMonthIcon className="w-4 h-4 shrink-0" />
                <span>Semua Cerita</span>
              </span>
              <span className="text-xs opacity-85">{entries.length}</span>
            </button>
          </div>

          {monthFolders.map(([year, months]) => (
            <div key={year} className="space-y-1">
              <div className="px-3 text-[11px] font-extrabold uppercase tracking-wider text-walnut">
                Folder Tahun {year}
              </div>
              {months.map((m) => {
                const isActive =
                  selectedMonth === m.monthKey &&
                  !trimmedSearch &&
                  viewMode === 'list';
                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => {
                      setSelectedMonth(m.monthKey);
                      setSearchQuery('');
                      setViewMode('list');
                    }}
                    className={`w-full text-left px-3 py-2.5 min-h-[42px] rounded-xl text-sm font-bold flex items-center justify-between transition cursor-pointer ${
                      isActive
                        ? 'bg-forest text-white'
                        : 'text-ink hover:bg-cream/80'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <FolderMonthIcon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-cream text-walnut'
                      }`}
                    >
                      {m.count}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Bottom Utilities */}
        <div className="p-3.5 border-t border-rule space-y-2 bg-parchment">
          <button
            type="button"
            onClick={onOpenExport}
            className="w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border border-rule-strong bg-paper text-ink text-xs font-bold hover:bg-cream flex items-center justify-center gap-2 cursor-pointer"
          >
            <WordDocIcon className="w-4 h-4 text-forest" />
            <span>Export Word (.docx)</span>
          </button>

          <button
            type="button"
            onClick={onToggleParentMode}
            className={`w-full px-3.5 py-2.5 min-h-[42px] rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
              parentMode
                ? 'bg-terracotta text-white border-terracotta hover:bg-terracotta-hover'
                : 'border-rule-strong bg-cream text-ink hover:bg-paper'
            }`}
          >
            <LockShieldIcon className="w-4 h-4 shrink-0" />
            <span>
              {parentMode ? 'Mode Orang Tua Aktif (Kunci)' : 'Mode Orang Tua'}
            </span>
          </button>

          <p className="text-[11px] font-bold text-walnut text-center pt-0.5 flex items-center justify-center gap-1.5">
            {isRealtime && (
              <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0 animate-pulse" />
            )}
            <span>{quietSyncText}</span>
          </p>
        </div>
      </aside>

      {/* RIGHT FOCUSED AREA */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Breadcrumb Bar */}
        <header className="px-6 sm:px-8 py-4 bg-paper border-b border-rule flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <button
              type="button"
              onClick={onSwitchAccount}
              className="text-walnut hover:text-ink cursor-pointer"
            >
              Semua Akun
            </button>
            <span className="text-rule-strong">/</span>
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSearchQuery('');
              }}
              className="text-walnut hover:text-ink cursor-pointer"
            >
              {child.name}
            </button>

            {viewMode === 'editor' ? (
              <>
                <span className="text-rule-strong">/</span>
                <span className="text-forest font-extrabold">
                  {editingEntry
                    ? `Edit ${formatDateLongID(editingEntry.dateKey)}`
                    : 'Menulis Cerita Hari Ini'}
                </span>
              </>
            ) : trimmedSearch ? (
              <>
                <span className="text-rule-strong">/</span>
                <span className="text-forest font-extrabold">
                  Pencarian: "{searchQuery.trim()}"
                </span>
              </>
            ) : selectedMonth === 'ALL' ? (
              <>
                <span className="text-rule-strong">/</span>
                <span className="text-forest font-extrabold">Semua Bulan</span>
              </>
            ) : (
              activeMonthParts && (
                <>
                  <span className="text-rule-strong">/</span>
                  <span className="text-walnut">{activeMonthParts.year}</span>
                  <span className="text-rule-strong">/</span>
                  <span className="text-forest font-extrabold">
                    {activeMonthParts.monthName}
                  </span>
                </>
              )
            )}
          </nav>

          <div className="flex items-center gap-3 text-xs font-bold text-walnut">
            {parentMode && (
              <span className="px-2.5 py-1 rounded-md bg-terracotta text-white font-extrabold">
                Mode Orang Tua
              </span>
            )}
            <span>Hari ini: {formatDateLongID(todayKey)}</span>
          </div>
        </header>

        {/* Focused Workspace Body */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col">
          {viewMode === 'editor' ? (
            <JournalEditor
              child={child}
              entry={editingEntry}
              parentMode={parentMode}
              onSave={handleSaveAndStay}
              onDelete={parentMode && editingEntry ? handleDeleteFromEditor : undefined}
              onBack={() => setViewMode('list')}
            />
          ) : (
            <div className="max-w-4xl w-full mx-auto space-y-6">
              {/* Today's Focused Prompt Card */}
              {!trimmedSearch && (
                <section className="notebook-card rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-terracotta">
                      {formatDateLongID(todayKey)}
                    </div>
                    <h1 className="font-display text-xl sm:text-2xl font-bold text-ink">
                      {todayEntries.length > 0
                        ? `Hebat, ${child.nickname || child.name} sudah bercerita hari ini`
                        : `Halo ${child.nickname || child.name}, apa ceritamu hari ini?`}
                    </h1>
                    <p className="text-sm font-semibold text-walnut">
                      {todayEntries.length > 0
                        ? 'Kamu bisa membuka lagi tulisan hari ini untuk melengkapinya, atau menulis catatan baru untuk hari ini.'
                        : 'Cerita baru hanya bisa ditulis pada tanggal hari ini.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {todayEntries.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openEditEntry(todayEntries[0])}
                        className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-sm font-bold hover:bg-parchment cursor-pointer"
                      >
                        Lanjutkan Tulisan Hari Ini
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openNewToday}
                      className="px-5 py-2.5 min-h-[44px] rounded-xl bg-terracotta text-white text-sm font-extrabold hover:bg-terracotta-hover flex items-center gap-2 cursor-pointer"
                    >
                      <PencilNibIcon className="w-4 h-4" />
                      <span>
                        {todayEntries.length > 0
                          ? 'Tambah Catatan Hari Ini'
                          : 'Mulai Menulis'}
                      </span>
                    </button>
                  </div>
                </section>
              )}

              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-ink">
                  {trimmedSearch
                    ? `Hasil pencarian (${visibleEntries.length})`
                    : selectedMonth === 'ALL'
                      ? `Semua Cerita ${child.name} (${visibleEntries.length})`
                      : `Cerita Bulan ${formatMonthYearID(selectedMonth)} (${visibleEntries.length})`}
                </h2>
                {trimmedSearch && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-bold text-forest underline cursor-pointer"
                  >
                    Hapus pencarian
                  </button>
                )}
              </div>

              {/* Empty State vs Entries Feed */}
              {visibleEntries.length === 0 ? (
                <div className="notebook-card rounded-2xl p-8 text-center space-y-3">
                  <h3 className="font-display text-lg font-bold text-ink">
                    {trimmedSearch
                      ? `Tidak ditemukan cerita dengan kata "${searchQuery.trim()}"`
                      : `Belum ada cerita di folder ${
                          selectedMonth === 'ALL'
                            ? 'ini'
                            : formatMonthYearID(selectedMonth)
                        }`}
                  </h3>
                  <p className="text-sm font-semibold text-walnut max-w-md mx-auto">
                    {trimmedSearch
                      ? 'Coba pakai kata kunci lain, seperti nama kegiatan, makanan, atau nama hari.'
                      : 'Klik tombol "Mulai Menulis" di atas untuk mencatat cerita pertamamu hari ini.'}
                  </p>
                  {!trimmedSearch && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={openNewToday}
                        className="px-5 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover cursor-pointer"
                      >
                        Tulis Cerita Hari Ini
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleEntries.map((entry) => {
                    const isDeleting = parentMode && deletingId === entry.id;
                    const photoCount = entry.attachments.filter((a) => a.type === 'photo').length;
                    const voiceCount = entry.attachments.filter((a) => a.type === 'voice').length;

                    return (
                      <article
                        key={entry.id}
                        className="notebook-card rounded-2xl p-5 sm:p-6 space-y-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-rule">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-bold text-forest">
                              {formatDateLongID(entry.dateKey)}
                            </h3>
                            {entry.dateKey === todayKey && (
                              <span className="px-2 py-0.5 rounded bg-parchment text-ink text-[11px] font-extrabold border border-rule">
                                Hari Ini
                              </span>
                            )}
                            {entry.syncStatus === 'pending' && syncState.configured && (
                              <span className="px-2 py-0.5 rounded bg-cream text-walnut text-[11px] font-bold border border-rule">
                                Menunggu internet
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditEntry(entry)}
                              className="px-3.5 py-2 min-h-[40px] rounded-xl border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-parchment flex items-center gap-1.5 cursor-pointer"
                            >
                              <PencilNibIcon className="w-3.5 h-3.5" />
                              <span>Buka / Edit</span>
                            </button>
                            {parentMode && !isDeleting && (
                              <button
                                type="button"
                                onClick={() => setDeletingId(entry.id)}
                                className="px-3 py-2 min-h-[40px] rounded-xl border border-rule bg-paper text-danger text-xs font-bold hover:bg-[#FDF2F2] flex items-center gap-1 cursor-pointer"
                                aria-label={`Hapus cerita tanggal ${formatDateLongID(entry.dateKey)}`}
                              >
                                <TrashBinIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isDeleting && (
                          <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-danger flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-danger">
                              Yakin ingin menghapus cerita ini?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                className="px-3 py-1.5 rounded-lg border border-rule bg-paper text-ink text-xs font-bold cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickDelete(entry)}
                                className="px-3.5 py-1.5 rounded-lg bg-danger text-white text-xs font-bold cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                            </div>
                          </div>
                        )}

                        {entry.content && (
                          <p className="text-sm sm:text-base font-semibold text-ink whitespace-pre-line leading-relaxed">
                            {entry.content}
                          </p>
                        )}

                        {entry.attachments.length > 0 && (
                          <div className="pt-2 space-y-2">
                            <div className="flex flex-wrap gap-2 text-xs font-bold text-walnut">
                              {photoCount > 0 && <span>{photoCount} foto</span>}
                              {photoCount > 0 && voiceCount > 0 && <span>/</span>}
                              {voiceCount > 0 && <span>{voiceCount} rekaman suara</span>}
                            </div>
                            <MediaGallery attachments={entry.attachments} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
