import { useEffect, useRef, useState } from 'react';
import type { ChildProfile, JournalEntry, MediaAttachment } from '../types';
import {
  formatDateLongID,
  formatDuration,
  getMonthKeyFromDate,
  getTodayDateKey,
} from '../lib/date';
import { compressImageBlob, createId } from '../lib/media';
import { deleteMediaBlobLocal, saveMediaBlobLocal } from '../lib/db';
import { CameraModal } from './CameraModal';
import { MediaGallery } from './MediaPreview';
import { WRITING_HINTS, type WritingHint } from '../data/hints';
import {
  CameraLensIcon,
  CheckMarkIcon,
  ChevronLeftIcon,
  GalleryPhotoIcon,
  IdeaLampIcon,
  ShuffleCardsIcon,
  TrashBinIcon,
  VoiceMicIcon,
} from './Icons';

interface JournalEditorProps {
  child: ChildProfile;
  /** Pass null when creating today's new entry */
  entry: JournalEntry | null;
  parentMode: boolean;
  onSave: (entry: JournalEntry) => Promise<void>;
  onDelete?: (entry: JournalEntry) => Promise<void>;
  onBack: () => void;
}

export function JournalEditor({
  child,
  entry,
  parentMode,
  onSave,
  onDelete,
  onBack,
}: JournalEditorProps) {
  const isNew = !entry;
  const todayKey = getTodayDateKey();
  // Strict date rule: new entries are always stamped with today's calendar date
  const lockedDateKey = entry ? entry.dateKey : todayKey;
  const isToday = lockedDateKey === todayKey;
  const isReadOnly = !isToday;
  const MAX_PHOTOS = 5;

  const entryIdRef = useRef<string>(entry?.id ?? createId('cerita'));
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  const [content, setContent] = useState(entry?.content ?? '');
  const [attachments, setAttachments] = useState<MediaAttachment[]>(
    entry?.attachments ?? []
  );

  const initialContentRef = useRef(entry?.content ?? '');
  const initialAttachmentsCountRef = useRef(entry?.attachments?.length ?? 0);

  const isDirty =
    !isReadOnly &&
    (content !== initialContentRef.current ||
      attachments.length !== initialAttachmentsCountRef.current);

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [currentHint, setCurrentHint] = useState<WritingHint>(() => {
    return (
      WRITING_HINTS[Math.floor(Math.random() * WRITING_HINTS.length)] ??
      WRITING_HINTS[0]
    );
  });

  const [showCamera, setShowCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync state if user opens a different entry
  useEffect(() => {
    entryIdRef.current = entry?.id ?? createId('cerita');
    setContent(entry?.content ?? '');
    setAttachments(entry?.attachments ?? []);
    initialContentRef.current = entry?.content ?? '';
    initialAttachmentsCountRef.current = entry?.attachments?.length ?? 0;
    setError(null);
    setSavedNotice(null);
    setConfirmDelete(false);
    setShowUnsavedModal(false);
    if (!entry) {
      bodyRef.current?.focus();
    }
  }, [entry]);

  useEffect(() => {
    if (!parentMode) setConfirmDelete(false);
  }, [parentMode]);

  // Cleanup active mic recording on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  // Keyboard shortcut Ctrl+S / Cmd+S for tablet wireless keyboard & laptop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving && !recording && !isReadOnly) {
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Warn before closing browser/tab if user has unsaved changes
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

  function handleShuffleHint() {
    setCurrentHint((prev) => {
      const pool = WRITING_HINTS.filter((h) => h.id !== prev?.id);
      return pool[Math.floor(Math.random() * pool.length)] ?? WRITING_HINTS[0];
    });
  }

  function handleAttemptBack() {
    if (isDirty) {
      setShowUnsavedModal(true);
      return;
    }
    onBack();
  }

  const photoCount = attachments.filter((a) => a.type === 'photo').length;

  async function addPhotoBlob(rawBlob: Blob) {
    if (isReadOnly) return;
    const currentPhotoCount = attachments.filter((a) => a.type === 'photo').length;
    if (currentPhotoCount >= MAX_PHOTOS) {
      setError(`Maksimal ${MAX_PHOTOS} foto per cerita.`);
      return;
    }

    setError(null);
    try {
      const compressed = await compressImageBlob(rawBlob, 800, 0.68);
      const id = createId('foto');
      await saveMediaBlobLocal(id, entryIdRef.current, compressed);
      const att: MediaAttachment = {
        id,
        type: 'photo',
        mimeType: compressed.type || 'image/jpeg',
        remoteSynced: false,
        createdAt: Date.now(),
      };
      setAttachments((prev) => [...prev, att]);
      setSavedNotice(null);
    } catch {
      setError('Foto gagal ditambahkan. Coba pilih gambar lain.');
    }
  }

  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) return;
    const files = Array.from(e.target.files ?? []);
    const currentPhotos = attachments.filter((a) => a.type === 'photo').length;
    const remainingSlots = MAX_PHOTOS - currentPhotos;

    if (remainingSlots <= 0) {
      setError(`Maksimal ${MAX_PHOTOS} foto per cerita.`);
      e.target.value = '';
      return;
    }

    const toAdd = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setError(
        `Hanya ${remainingSlots} foto yang ditambahkan karena batas maksimal ${MAX_PHOTOS} foto.`
      );
    }

    for (const file of toAdd) {
      await addPhotoBlob(file);
    }
    e.target.value = '';
  }

  async function handleToggleRecording() {
    if (isReadOnly) return;
    setError(null);
    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Browser ini belum mendukung rekaman suara.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const mimeType =
        preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 })
        : new MediaRecorder(stream);

      recordChunksRef.current = [];
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      setRecording(true);

      recordTimerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(elapsed);
        if (elapsed >= 120 && recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 300);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setRecording(false);

        const durationSec = Math.max(
          1,
          Math.round((Date.now() - recordStartRef.current) / 1000)
        );
        const finalType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordChunksRef.current, { type: finalType });
        if (blob.size === 0) return;

        const id = createId('suara');
        await saveMediaBlobLocal(id, entryIdRef.current, blob);
        const att: MediaAttachment = {
          id,
          type: 'voice',
          mimeType: finalType,
          durationSec,
          remoteSynced: false,
          createdAt: Date.now(),
        };
        setAttachments((prev) => [...prev, att]);
        setSavedNotice(null);
      };

      recorderRef.current = recorder;
      recorder.start();
    } catch {
      setError('Izin mikrofon belum aktif. Izinkan akses mikrofon di browser untuk merekam suara.');
      setRecording(false);
    }
  }

  async function handleRemoveAttachment(id: string) {
    if (!parentMode) return;
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteMediaBlobLocal(id);
    } catch {
      // ignore
    }
    setSavedNotice(null);
  }

  async function handleSave() {
    if (isReadOnly) return;
    if (recording) {
      setError('Hentikan rekaman suara dulu sebelum menyimpan.');
      return;
    }

    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0) {
      setError('Tuliskan ceritamu atau tambahkan foto/suara dulu sebelum menyimpan.');
      bodyRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    const now = Date.now();

    try {
      const updatedEntry: JournalEntry = {
        id: entryIdRef.current,
        childId: child.id,
        dateKey: lockedDateKey,
        monthKey: getMonthKeyFromDate(lockedDateKey),
        title: '',
        content: trimmedContent,
        attachments,
        createdAt: entry?.createdAt ?? now,
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending',
      };
      await onSave(updatedEntry);
      initialContentRef.current = trimmedContent;
      initialAttachmentsCountRef.current = attachments.length;
      setSavedNotice('Ceritamu sudah tersimpan.');
    } catch {
      setError('Gagal menyimpan cerita. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!parentMode || !entry || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(entry);
    } catch {
      setError('Gagal menghapus cerita.');
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto">
      {/* Top Paper Utility Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={handleAttemptBack}
          className="px-3.5 py-2 min-h-[42px] rounded-xl border border-rule-strong bg-paper text-ink text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-parchment/60 cursor-pointer"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span>Kembali ke Daftar</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          {parentMode && !isNew && onDelete && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="px-3.5 py-2 min-h-[42px] rounded-xl border border-rule bg-paper text-danger text-xs font-bold hover:bg-[#FDF2F2] flex items-center gap-1.5 cursor-pointer"
            >
              <TrashBinIcon className="w-4 h-4" />
              <span>Hapus Cerita</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Delete Confirmation (Parent Mode Only) */}
      {parentMode && confirmDelete && (
        <div className="mb-4 p-4 rounded-xl bg-[#FDF2F2] border border-danger flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-bold text-danger">
            Yakin ingin menghapus cerita tanggal {formatDateLongID(lockedDateKey)}?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3.5 py-2 min-h-[38px] rounded-lg border border-rule bg-paper text-ink text-xs font-bold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={saving}
              className="px-4 py-2 min-h-[38px] rounded-lg bg-danger text-white text-xs font-bold cursor-pointer"
            >
              Ya, Hapus Cerita
            </button>
          </div>
        </div>
      )}

      {/* Main Notebook Writing Sheet */}
      <div className="notebook-card rounded-2xl overflow-hidden flex flex-1 flex-col sm:flex-row">
        {/* Classic Stitched Notebook Spine */}
        <div
          className="w-9 sm:w-11 shrink-0 bg-parchment border-r border-rule flex flex-col items-center justify-around py-8 hidden sm:flex"
          aria-hidden="true"
        >
          <span className="w-3.5 h-3.5 rounded-full bg-cream border border-rule-strong/70" />
          <span className="w-3.5 h-3.5 rounded-full bg-cream border border-rule-strong/70" />
          <span className="w-3.5 h-3.5 rounded-full bg-cream border border-rule-strong/70" />
          <span className="w-3.5 h-3.5 rounded-full bg-cream border border-rule-strong/70" />
          <span className="w-3.5 h-3.5 rounded-full bg-cream border border-rule-strong/70" />
          <span className="w-3.5 h-3.5 rounded-full bg-cream border border-rule-strong/70" />
        </div>

        {/* Paper Content */}
        <div className="flex-1 p-5 sm:p-7 flex flex-col gap-4">
          {/* Date Stamp */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-rule">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-lg sm:text-xl font-bold text-forest">
                {formatDateLongID(lockedDateKey)}
              </span>
              {isToday ? (
                <span className="px-2.5 py-0.5 rounded-md bg-forest/15 text-forest text-xs font-bold border border-forest/30">
                  Hari Ini (Bisa Ditulis/Diedit)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-parchment text-walnut text-xs font-bold border border-rule">
                  Kenangan Lalu (Hanya Baca)
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-walnut">
              Buku {child.name}
            </span>
          </div>

          {/* Inline Writing Hint (Displayed automatically on top of writing area, non-popup) */}
          {!isReadOnly && (
            <div className="rounded-xl bg-parchment/80 border border-rule-strong p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-forest/15 text-forest flex items-center justify-center shrink-0">
                  <IdeaLampIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-terracotta uppercase tracking-wider">
                    Ide Cerita Hari Ini
                  </p>
                  <p className="text-sm font-bold text-ink">
                    "{currentHint.question}"{' '}
                    <span className="text-xs font-semibold text-walnut hidden sm:inline">
                      {currentHint.followUp}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleShuffleHint}
                className="shrink-0 px-3 py-1.5 min-h-[36px] rounded-lg border border-rule-strong bg-paper text-ink text-xs font-bold hover:bg-cream flex items-center gap-1.5 cursor-pointer"
                title="Ganti ide cerita secara acak"
              >
                <ShuffleCardsIcon className="w-3.5 h-3.5 text-forest" />
                <span>Ide Lain</span>
              </button>
            </div>
          )}

          {/* Read-only Notice for Past Stories */}
          {isReadOnly && (
            <div className="p-3 rounded-xl bg-parchment border border-rule-strong text-walnut text-xs sm:text-sm font-semibold flex items-center gap-2">
              <span>📖 Cerita hari sebelumnya disimpan sebagai kenangan dan tidak dapat diubah lagi.</span>
            </div>
          )}

          {/* Direct Lined Writing Area */}
          <textarea
            ref={bodyRef}
            value={content}
            readOnly={isReadOnly}
            onChange={(e) => {
              if (isReadOnly) return;
              setContent(e.target.value);
              setSavedNotice(null);
            }}
            rows={11}
            placeholder={
              isReadOnly
                ? 'Cerita ini kosong.'
                : 'Ceritakan apa saja yang kamu alami, rasakan, atau pikirkan hari ini...'
            }
            aria-label="Isi cerita buku harian"
            className={`diary-lined-paper w-full flex-1 min-h-[320px] bg-transparent text-ink text-base sm:text-[18px] font-semibold placeholder:text-walnut/55 focus:outline-none ${
              isReadOnly ? 'cursor-default resize-none' : 'resize-y'
            }`}
          />

          {/* Attached Photos & Voice Notes */}
          {attachments.length > 0 && (
            <div className="pt-3 border-t border-rule space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wide text-walnut flex items-center justify-between">
                <span>Lampiran Cerita ({attachments.length})</span>
                {photoCount > 0 && (
                  <span className="text-[11px] font-semibold text-walnut">
                    {photoCount}/{MAX_PHOTOS} Foto
                  </span>
                )}
              </div>
              <MediaGallery
                attachments={attachments}
                editable={parentMode && !isReadOnly}
                onRemove={parentMode && !isReadOnly ? handleRemoveAttachment : undefined}
              />
            </div>
          )}

          {/* Media Buttons Row (Only for Today's Entries) */}
          {!isReadOnly && (
            <div className="pt-3 border-t border-rule flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={photoCount >= MAX_PHOTOS}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-parchment disabled:opacity-45 flex items-center gap-2 cursor-pointer"
                title={photoCount >= MAX_PHOTOS ? `Sudah mencapai batas maksimal ${MAX_PHOTOS} foto` : 'Tambah foto dari galeri'}
              >
                <GalleryPhotoIcon className="w-4 h-4 text-forest" />
                <span>
                  {photoCount >= MAX_PHOTOS
                    ? `Foto Penuh (${photoCount}/${MAX_PHOTOS})`
                    : `Tambah Foto Galeri (${photoCount}/${MAX_PHOTOS})`}
                </span>
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryChange}
              />

              <button
                type="button"
                onClick={() => {
                  if (photoCount >= MAX_PHOTOS) {
                    setError(`Maksimal ${MAX_PHOTOS} foto per cerita.`);
                    return;
                  }
                  setShowCamera(true);
                }}
                disabled={photoCount >= MAX_PHOTOS}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-parchment disabled:opacity-45 flex items-center gap-2 cursor-pointer"
              >
                <CameraLensIcon className="w-4 h-4 text-forest" />
                <span>Kamera Selfie</span>
              </button>

              <button
                type="button"
                onClick={handleToggleRecording}
                className={`px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer ${
                  recording
                    ? 'bg-danger text-white border-danger'
                    : 'border-rule-strong bg-cream text-ink hover:bg-parchment'
                }`}
              >
                <VoiceMicIcon className="w-4 h-4" />
                <span>
                  {recording
                    ? `Hentikan Rekaman (${formatDuration(recordSeconds)})`
                    : 'Rekam Voice Note'}
                </span>
              </button>
            </div>
          )}

          {/* Feedback Banners */}
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

          {/* Bottom Save Bar */}
          <div className="pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-walnut">
              {!isReadOnly
                ? 'Tips keyboard: tekan Ctrl + S untuk menyimpan dengan cepat.'
                : 'Membaca kenangan cerita masa lalu.'}
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleAttemptBack}
                className="px-4 py-3 min-h-[46px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
              >
                Tutup Halaman
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || recording}
                  className="px-7 py-3 min-h-[46px] rounded-xl bg-forest text-white text-sm sm:text-base font-extrabold hover:bg-forest-hover disabled:opacity-45 flex items-center gap-2 cursor-pointer"
                >
                  <CheckMarkIcon className="w-5 h-5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="notebook-card rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-rule-strong">
            <h3 className="font-display text-lg font-bold text-ink">
              Cerita Belum Disimpan
            </h3>
            <p className="text-sm font-semibold text-walnut leading-relaxed">
              Ada cerita atau foto yang belum kamu simpan. Apakah kamu yakin ingin keluar tanpa menyimpan? Tulisan yang belum disimpan akan hilang.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnsavedModal(false)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-rule-strong bg-paper text-ink text-xs sm:text-sm font-bold hover:bg-cream cursor-pointer"
              >
                Tetap Menulis
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedModal(false);
                  onBack();
                }}
                className="px-4 py-2.5 min-h-[42px] rounded-xl border border-danger/40 bg-white text-danger text-xs sm:text-sm font-bold hover:bg-[#FDF2F2] cursor-pointer"
              >
                Buang Perubahan
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowUnsavedModal(false);
                  await handleSave();
                  onBack();
                }}
                disabled={saving}
                className="px-5 py-2.5 min-h-[42px] rounded-xl bg-forest text-white text-xs sm:text-sm font-bold hover:bg-forest-hover cursor-pointer"
              >
                Simpan &amp; Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraModal
          title="Ambil Foto untuk Cerita"
          onCapture={(blob) => {
            setShowCamera(false);
            void addPhotoBlob(blob);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
