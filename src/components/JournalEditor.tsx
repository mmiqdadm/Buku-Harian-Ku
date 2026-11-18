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
import { HintModal } from './HintModal';
import { MediaGallery } from './MediaPreview';
import {
  CameraLensIcon,
  CheckMarkIcon,
  ChevronLeftIcon,
  GalleryPhotoIcon,
  IdeaLampIcon,
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

  const [showHint, setShowHint] = useState(false);
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
    setError(null);
    setSavedNotice(null);
    setConfirmDelete(false);
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
        if (!saving && !recording) {
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function addPhotoBlob(rawBlob: Blob) {
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
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      await addPhotoBlob(file);
    }
    e.target.value = '';
  }

  async function handleToggleRecording() {
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
          onClick={onBack}
          className="px-3.5 py-2 min-h-[42px] rounded-xl border border-rule-strong bg-paper text-ink text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-parchment/60 cursor-pointer"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span>Kembali ke Daftar</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowHint(true)}
            className="px-4 py-2 min-h-[42px] rounded-xl bg-terracotta text-white text-xs sm:text-sm font-bold hover:bg-terracotta-hover flex items-center gap-2 cursor-pointer"
          >
            <IdeaLampIcon className="w-4 h-4" />
            <span>Butuh Ide? (Hint)</span>
          </button>

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
      <div className="notebook-card rounded-2xl overflow-hidden flex flex-1">
        {/* Classic Stitched Notebook Spine */}
        <div
          className="w-9 sm:w-11 shrink-0 bg-parchment border-r border-rule flex flex-col items-center justify-around py-8"
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
                <span className="px-2.5 py-0.5 rounded-md bg-parchment text-ink text-xs font-bold border border-rule">
                  Hari Ini
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-parchment text-walnut text-xs font-bold border border-rule">
                  Mode Edit Cerita Lama
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-walnut">
              Buku {child.name}
            </span>
          </div>

          {/* Direct Lined Writing Area (no title field) */}
          <textarea
            ref={bodyRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSavedNotice(null);
            }}
            rows={11}
            placeholder="Ceritakan apa saja yang kamu alami, rasakan, atau pikirkan hari ini..."
            aria-label="Isi cerita buku harian"
            className="diary-lined-paper w-full flex-1 min-h-[320px] bg-transparent text-ink text-base sm:text-[18px] font-semibold placeholder:text-walnut/55 resize-y focus:outline-none"
          />

          {/* Attached Photos & Voice Notes */}
          {attachments.length > 0 && (
            <div className="pt-3 border-t border-rule space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                Lampiran Cerita ({attachments.length})
              </div>
              <MediaGallery
                attachments={attachments}
                editable={parentMode}
                onRemove={parentMode ? handleRemoveAttachment : undefined}
              />
            </div>
          )}

          {/* Media Buttons Row */}
          <div className="pt-3 border-t border-rule flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-parchment flex items-center gap-2 cursor-pointer"
            >
              <GalleryPhotoIcon className="w-4 h-4 text-forest" />
              <span>Tambah Foto Galeri</span>
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
              onClick={() => setShowCamera(true)}
              className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs sm:text-sm font-bold hover:bg-parchment flex items-center gap-2 cursor-pointer"
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
              Tips keyboard: tekan Ctrl + S untuk menyimpan dengan cepat.
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-3 min-h-[46px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
              >
                Tutup Halaman
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || recording}
                className="px-7 py-3 min-h-[46px] rounded-xl bg-forest text-white text-sm sm:text-base font-extrabold hover:bg-forest-hover disabled:opacity-45 flex items-center gap-2 cursor-pointer"
              >
                <CheckMarkIcon className="w-5 h-5" />
                <span>{saving ? 'Menyimpan...' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showHint && (
        <HintModal
          childName={child.nickname || child.name}
          onClose={() => {
            setShowHint(false);
            bodyRef.current?.focus();
          }}
        />
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
