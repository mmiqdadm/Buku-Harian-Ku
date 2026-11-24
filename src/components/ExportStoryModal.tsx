import { useEffect, useState } from 'react';
import type { ChildProfile, CreativeStory } from '../types';
import { CloseCrossIcon, PdfDocIcon, WordDocIcon } from './Icons';

interface ExportStoryModalProps {
  story: CreativeStory;
  author: ChildProfile;
  onClose: () => void;
}

export function ExportStoryModal({ story, author, onClose }: ExportStoryModalProps) {
  const [exportingType, setExportingType] = useState<'word' | 'pdf' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalChapters = story.chapters?.length || 0;
  const totalPhotos = (story.chapters || []).reduce(
    (acc, chap) => acc + (chap.attachments?.filter((a) => a.type === 'photo').length || 0),
    0
  );

  async function handleExportWord() {
    setExportingType('word');
    setError(null);
    setMessage(null);
    try {
      const { exportStoryToWord } = await import('../lib/exportWord');
      const fileName = await exportStoryToWord(story, author);
      setMessage(`Berhasil mengunduh dokumen Word: ${fileName}.`);
    } catch {
      setError('Gagal membuat file Word buku cerita. Silakan coba lagi.');
    } finally {
      setExportingType(null);
    }
  }

  async function handleExportPdf() {
    setExportingType('pdf');
    setError(null);
    setMessage(null);
    try {
      const { exportStoryToPdf } = await import('../lib/exportPdf');
      const fileName = await exportStoryToPdf(story, author);
      setMessage(`Berhasil mengunduh dokumen PDF: ${fileName}. Siap dicetak atau dibaca di perangkat apapun.`);
    } catch {
      setError('Gagal membuat file PDF buku cerita. Silakan coba lagi.');
    } finally {
      setExportingType(null);
    }
  }

  const isExporting = exportingType !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221C]/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-story-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="notebook-card rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-parchment/75 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📖</span>
            <div>
              <h2 id="export-story-title" className="text-lg font-bold text-ink">
                Export Buku Cerita
              </h2>
              <p className="text-xs font-semibold text-walnut">
                Unduh karya cerita ke format dokumen Word (.docx) atau PDF (.pdf).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-rule bg-paper text-ink hover:border-rule-strong flex items-center justify-center cursor-pointer"
            aria-label="Tutup dialog export"
          >
            <CloseCrossIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Story Summary Card */}
          <div className="rounded-xl bg-parchment/70 border border-rule-strong p-4.5 space-y-2">
            <div className="font-display text-base font-bold text-ink">
              {story.title || 'Tanpa Judul'}
            </div>
            <div className="text-xs font-semibold text-walnut flex flex-wrap items-center gap-3">
              <span>Penulis: <strong className="text-ink">{author.name}</strong></span>
              <span>•</span>
              <span>Jumlah: <strong className="text-ink">{totalChapters} Bab</strong></span>
              {totalPhotos > 0 && (
                <>
                  <span>•</span>
                  <span>Foto: <strong className="text-ink">{totalPhotos} Gambar</strong></span>
                </>
              )}
            </div>
            {story.synopsis ? (
              <p className="text-xs font-medium text-walnut/90 italic line-clamp-3 pt-1 border-t border-rule/60">
                &ldquo;{story.synopsis}&rdquo;
              </p>
            ) : (
              <p className="text-xs font-medium text-walnut/60 italic pt-1 border-t border-rule/60">
                Belum ada sinopsis.
              </p>
            )}
          </div>

          <p className="text-xs font-semibold text-walnut leading-relaxed">
            Pilih format dokumen yang kamu inginkan. File akan otomatis memuat judul buku, sinopsis, setiap bab, dan foto ilustrasi secara rapi.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-[#FDF2F2] border border-danger text-danger text-xs font-bold">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded-xl bg-[#EAF4F0] border border-forest text-forest text-xs font-bold">
              {message}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-terracotta text-white text-sm font-bold hover:bg-terracotta-hover disabled:opacity-45 flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <PdfDocIcon className="w-4 h-4" />
              <span>{exportingType === 'pdf' ? 'Menyiapkan PDF...' : 'Unduh PDF (.pdf)'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportWord}
              disabled={isExporting}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover disabled:opacity-45 flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <WordDocIcon className="w-4 h-4" />
              <span>{exportingType === 'word' ? 'Menyiapkan Word...' : 'Unduh Word (.docx)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
