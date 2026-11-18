import { useEffect, useMemo, useState } from 'react';
import type { ChildProfile, JournalEntry } from '../types';
import { getTodayDateKey } from '../lib/date';
import { CloseCrossIcon, WordDocIcon } from './Icons';

function filterByDateRange(
  entries: JournalEntry[],
  startDate: string,
  endDate: string
): JournalEntry[] {
  return entries
    .filter((e) => !e.deleted && e.dateKey >= startDate && e.dateKey <= endDate)
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      return a.createdAt - b.createdAt;
    });
}

interface ExportWordModalProps {
  child: ChildProfile;
  entries: JournalEntry[];
  onClose: () => void;
}

export function ExportWordModal({ child, entries, onClose }: ExportWordModalProps) {
  const today = getTodayDateKey();
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const matching = useMemo(
    () => filterByDateRange(entries, startDate, endDate),
    [entries, startDate, endDate]
  );

  function applyPreset(preset: 'month' | '30days' | 'all') {
    setError(null);
    setMessage(null);
    if (preset === 'month') {
      setStartDate(firstOfMonth);
      setEndDate(today);
      return;
    }
    if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setStartDate(`${y}-${m}-${day}`);
      setEndDate(today);
      return;
    }
    if (entries.length > 0) {
      const sortedDates = entries
        .filter((e) => !e.deleted)
        .map((e) => e.dateKey)
        .sort();
      setStartDate(sortedDates[0] ?? firstOfMonth);
      setEndDate(sortedDates[sortedDates.length - 1] ?? today);
    } else {
      setStartDate(firstOfMonth);
      setEndDate(today);
    }
  }

  async function handleExport() {
    if (!startDate || !endDate || startDate > endDate) {
      setError('Tanggal mulai harus lebih awal atau sama dengan tanggal akhir.');
      return;
    }
    if (matching.length === 0) {
      setError('Tidak ada cerita dalam rentang tanggal yang dipilih.');
      return;
    }

    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const { exportDiaryToWord } = await import('../lib/exportWord');
      const fileName = await exportDiaryToWord({
        child,
        entries,
        startDate,
        endDate,
      });
      setMessage(`Berhasil mengunduh ${fileName}. File bisa langsung dibuka di Microsoft Word atau Google Docs.`);
    } catch {
      setError('Gagal membuat file Word. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221C]/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="notebook-card rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 bg-parchment/75 border-b border-rule flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <WordDocIcon className="w-5 h-5 text-forest" />
            <div>
              <h2 id="export-modal-title" className="text-lg font-bold text-ink">
                Export Buku {child.name} ke Word
              </h2>
              <p className="text-xs font-semibold text-walnut">
                Pilih rentang tanggal cerita yang ingin disimpan sebagai file .docx.
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
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('month')}
              className="px-3 py-1.5 min-h-[36px] rounded-lg border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-parchment cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => applyPreset('30days')}
              className="px-3 py-1.5 min-h-[36px] rounded-lg border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-parchment cursor-pointer"
            >
              30 Hari Terakhir
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className="px-3 py-1.5 min-h-[36px] rounded-lg border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-parchment cursor-pointer"
            >
              Semua Cerita
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                Dari Tanggal
              </span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-bold"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                Sampai Tanggal
              </span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-bold"
              />
            </label>
          </div>

          {/* Live Match Preview */}
          <div className="rounded-xl bg-parchment/60 border border-rule p-4 space-y-1">
            <div className="text-sm font-bold text-ink">
              {matching.length === 0
                ? 'Belum ada cerita di rentang tanggal ini'
                : `Ditemukan ${matching.length} cerita siap di-export`}
            </div>
            <p className="text-xs font-semibold text-walnut">
              Dokumen Word akan memuat biodata anak, tanggal lengkap, isi tulisan, serta foto yang dilampirkan.
            </p>
          </div>

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

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || matching.length === 0}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover disabled:opacity-45 flex items-center gap-2 cursor-pointer"
            >
              <WordDocIcon className="w-4 h-4" />
              <span>{exporting ? 'Menyiapkan File...' : 'Unduh Word (.docx)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
