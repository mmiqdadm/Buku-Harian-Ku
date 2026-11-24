import { useRef } from 'react';
import type { AccentTone, ChildProfile, SyncStateSummary } from '../types';
import { formatDateLongID, getTodayDateKey } from '../lib/date';
import {
  BookCoverIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockShieldIcon,
  PencilNibIcon,
  PlusMarkIcon,
} from './Icons';

interface ProfilePickerProps {
  profiles: ChildProfile[];
  entryCounts: Record<string, number>;
  parentMode: boolean;
  syncState?: SyncStateSummary;
  onSelectChild: (childId: string) => void;
  onEditProfile: (profile: ChildProfile) => void;
  onAddProfile: () => void;
  onToggleParentMode: () => void;
}

const TONE_COLOR: Record<AccentTone, string> = {
  forest: '#2B6A58',
  terracotta: '#B34423',
  ochre: '#8C621C',
  slate: '#3B5568',
};

export function ProfilePicker({
  profiles,
  entryCounts,
  parentMode,
  syncState,
  onSelectChild,
  onEditProfile,
  onAddProfile,
  onToggleParentMode,
}: ProfilePickerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayLabel = formatDateLongID(getTodayDateKey());

  function scrollByAmount(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between px-6 sm:px-10 py-6">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-rule">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-forest text-white flex items-center justify-center shrink-0">
            <BookCoverIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              Buku Harian Ku
            </h1>
            <p className="text-sm font-semibold text-walnut">
              {todayLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleParentMode}
          className={`px-4 py-2.5 min-h-[44px] rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer ${
            parentMode
              ? 'bg-terracotta text-white border-terracotta hover:bg-terracotta-hover'
              : 'border-rule-strong bg-paper text-ink hover:bg-parchment/60'
          }`}
        >
          <LockShieldIcon className="w-4 h-4" />
          <span>
            {parentMode ? 'Mode Orang Tua Aktif (Kunci)' : 'Mode Orang Tua'}
          </span>
        </button>
      </header>

      {/* Main Horizontal Shelf */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Pilih bukumu untuk mulai bercerita
            </h2>
            <p className="text-sm font-semibold text-walnut mt-1">
              Geser ke samping untuk melihat semua buku harian keluarga.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByAmount(-340)}
              className="w-11 h-11 rounded-xl border border-rule-strong bg-paper text-ink hover:bg-parchment/60 flex items-center justify-center cursor-pointer"
              aria-label="Geser daftar akun ke kiri"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount(340)}
              className="w-11 h-11 rounded-xl border border-rule-strong bg-paper text-ink hover:bg-parchment/60 flex items-center justify-center cursor-pointer"
              aria-label="Geser daftar akun ke kanan"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Strip */}
        <div
          ref={scrollRef}
          className="flex flex-row gap-5 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory warm-scroll"
          role="list"
          aria-label="Daftar akun anak"
        >
          {profiles.map((child) => {
            const coverColor = TONE_COLOR[child.accentTone] ?? '#2B6A58';
            const count = entryCounts[child.id] ?? 0;
            const initials = child.name.slice(0, 2).toUpperCase();

            return (
              <article
                key={child.id}
                role="listitem"
                className="notebook-card-interactive snap-start shrink-0 w-[300px] sm:w-[320px] rounded-2xl overflow-hidden flex"
              >
                {/* Stitched Book Spine */}
                <div
                  className="w-5 shrink-0 flex flex-col items-center justify-around py-6"
                  style={{ backgroundColor: coverColor }}
                  aria-hidden="true"
                >
                  <span className="w-2 h-2 rounded-full bg-cream/85" />
                  <span className="w-2 h-2 rounded-full bg-cream/85" />
                  <span className="w-2 h-2 rounded-full bg-cream/85" />
                  <span className="w-2 h-2 rounded-full bg-cream/85" />
                </div>

                <div className="flex-1 p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-white font-display text-2xl font-bold border border-rule"
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
                      <div className="min-w-0">
                        <h3 className="font-display text-2xl font-bold text-ink truncate">
                          {child.name}
                        </h3>
                        <p className="text-xs font-bold text-walnut mt-0.5">
                          {count === 0
                            ? 'Belum ada cerita'
                            : `${count} cerita tersimpan`}
                        </p>
                      </div>
                    </div>

                    {/* Biodata Snapshot */}
                    <div className="rounded-xl bg-parchment/60 border border-rule px-3.5 py-2.5 space-y-1 min-h-[76px]">
                      {child.hobby || child.dream || child.favoriteFood ? (
                        <>
                          {child.hobby && (
                            <p className="text-xs font-semibold text-ink truncate">
                              <span className="text-walnut">Hobi:</span> {child.hobby}
                            </p>
                          )}
                          {child.dream && (
                            <p className="text-xs font-semibold text-ink truncate">
                              <span className="text-walnut">Cita-cita:</span> {child.dream}
                            </p>
                          )}
                          {child.favoriteFood && (
                            <p className="text-xs font-semibold text-ink truncate">
                              <span className="text-walnut">Makanan favorit:</span> {child.favoriteFood}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs font-semibold text-walnut leading-relaxed">
                          Biodata buku masih kosong. Klik tombol Biodata untuk melengkapi hobi dan cita-cita.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectChild(child.id)}
                      className="flex-1 py-2.5 px-4 min-h-[44px] rounded-xl text-white text-sm font-bold hover:opacity-95 cursor-pointer"
                      style={{ backgroundColor: coverColor }}
                    >
                      Buka Buku {child.nickname || child.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditProfile(child)}
                      className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-xs font-bold hover:bg-cream flex items-center gap-1.5 cursor-pointer"
                      aria-label={`Edit profil dan biodata ${child.name}`}
                    >
                      <PencilNibIcon className="w-4 h-4" />
                      <span>Biodata</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Add Account Card */}
          <button
            type="button"
            onClick={onAddProfile}
            className="snap-start shrink-0 w-[250px] sm:w-[270px] rounded-2xl border-2 border-dashed border-rule-strong bg-paper/65 hover:bg-paper p-6 flex flex-col items-center justify-center text-center gap-3.5 transition cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-parchment border border-rule-strong text-forest flex items-center justify-center">
              <PlusMarkIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-ink">
                Tambah Akun Baru
              </div>
              <p className="text-xs font-semibold text-walnut mt-1 leading-relaxed">
                Buat buku harian baru lengkap dengan foto profil dan biodata anak.
              </p>
            </div>
          </button>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-walnut">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            {syncState?.configured && syncState.online && (
              <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0 animate-pulse" />
            )}
            <span>
              {!syncState?.configured
                ? 'Tersimpan di perangkat ini'
                : !syncState.online
                  ? 'Mode offline (tersimpan aman di perangkat ini)'
                  : syncState.syncing
                    ? 'Menyelaraskan ke cloud...'
                    : 'Tersinkron realtime ke cloud'}
            </span>
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-parchment border border-rule text-walnut">
            v1.1.0
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-[11px] font-bold text-forest hover:underline cursor-pointer"
            title="Muat ulang untuk memeriksa pembaruan aplikasi"
          >
            Muat Ulang
          </button>
        </div>
        <span>Dirancang untuk layar mendatar (tablet dengan keyboard &amp; laptop).</span>
      </footer>
    </div>
  );
}
