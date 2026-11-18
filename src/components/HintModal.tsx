import { useEffect, useMemo, useState } from 'react';
import {
  HINT_CATEGORIES,
  WRITING_HINTS,
  type HintCategory,
  type WritingHint,
} from '../data/hints';
import { CloseCrossIcon, IdeaLampIcon, ShuffleCardsIcon } from './Icons';

interface HintModalProps {
  childName: string;
  onClose: () => void;
}

function pickRandomHint(pool: WritingHint[], excludeId?: string): WritingHint {
  if (pool.length <= 1) return pool[0] ?? WRITING_HINTS[0];
  const candidates = excludeId ? pool.filter((h) => h.id !== excludeId) : pool;
  const list = candidates.length > 0 ? candidates : pool;
  return list[Math.floor(Math.random() * list.length)];
}

export function HintModal({ childName, onClose }: HintModalProps) {
  const [category, setCategory] = useState<HintCategory>('semua');
  const pool = useMemo(
    () =>
      category === 'semua'
        ? WRITING_HINTS
        : WRITING_HINTS.filter((h) => h.category === category),
    [category]
  );

  const [currentHint, setCurrentHint] = useState<WritingHint>(() =>
    pickRandomHint(WRITING_HINTS)
  );

  useEffect(() => {
    setCurrentHint((prev) => pickRandomHint(pool, prev?.id));
  }, [pool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleShuffle() {
    setCurrentHint((prev) => pickRandomHint(pool, prev.id));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221C]/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hint-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="notebook-card rounded-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-parchment/75 border-b border-rule flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-terracotta text-white flex items-center justify-center shrink-0">
              <IdeaLampIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-terracotta">
                Kartu Ide Cerita
              </p>
              <h2 id="hint-dialog-title" className="text-lg font-bold text-ink">
                Bingung mau cerita apa, {childName}?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[42px] min-h-[42px] rounded-xl border border-rule bg-paper text-ink hover:border-rule-strong flex items-center justify-center cursor-pointer"
            aria-label="Tutup kartu ide"
          >
            <CloseCrossIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          {HINT_CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold border transition cursor-pointer ${
                  active
                    ? 'bg-forest text-white border-forest'
                    : 'bg-cream text-walnut border-rule hover:border-rule-strong'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl bg-parchment/65 border-2 border-dashed border-rule-strong/60 p-5 space-y-2.5">
            <p className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug">
              "{currentHint.question}"
            </p>
            <p className="text-sm font-semibold text-walnut leading-relaxed">
              {currentHint.followUp}
            </p>
          </div>

          <p className="text-xs font-semibold text-walnut">
            Catatan: Kartu ini hanya membantu memancing ide. Ceritakan jawabannya dengan kata-katamu sendiri di halaman bukumu.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleShuffle}
              className="px-4 py-2.5 min-h-[44px] rounded-xl bg-terracotta text-white text-sm font-bold hover:bg-terracotta-hover flex items-center gap-2 cursor-pointer"
            >
              <ShuffleCardsIcon className="w-4 h-4" />
              <span>Acak Pertanyaan Lain</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover cursor-pointer"
            >
              Sudah Dapat Ide, Ayo Menulis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
