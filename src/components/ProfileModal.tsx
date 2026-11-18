import { useEffect, useRef, useState } from 'react';
import type { AccentTone, ChildProfile } from '../types';
import { compressAvatarToDataUrl, createId } from '../lib/media';
import { CameraModal } from './CameraModal';
import {
  CameraLensIcon,
  CloseCrossIcon,
  GalleryPhotoIcon,
  TrashBinIcon,
} from './Icons';

interface ProfileModalProps {
  profile: ChildProfile | null;
  nextOrder: number;
  parentMode: boolean;
  canDelete?: boolean;
  onSave: (profile: ChildProfile) => Promise<void>;
  onDelete?: (profile: ChildProfile) => Promise<void>;
  onClose: () => void;
}

const ACCENT_OPTIONS: { id: AccentTone; label: string; swatch: string }[] = [
  { id: 'forest', label: 'Hijau Daun', swatch: '#2B6A58' },
  { id: 'terracotta', label: 'Terakota', swatch: '#B34423' },
  { id: 'ochre', label: 'Kuning Madu', swatch: '#8C621C' },
  { id: 'slate', label: 'Biru Langit Tua', swatch: '#3B5568' },
];

export function ProfileModal({
  profile,
  nextOrder,
  parentMode,
  canDelete = false,
  onSave,
  onDelete,
  onClose,
}: ProfileModalProps) {
  const isEditing = Boolean(profile);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(profile?.name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [hobby, setHobby] = useState(profile?.hobby ?? '');
  const [favoriteFood, setFavoriteFood] = useState(profile?.favoriteFood ?? '');
  const [favoriteColor, setFavoriteColor] = useState(profile?.favoriteColor ?? '');
  const [dream, setDream] = useState(profile?.dream ?? '');
  const [aboutMe, setAboutMe] = useState(profile?.aboutMe ?? '');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(
    profile?.avatarDataUrl
  );
  const [accentTone, setAccentTone] = useState<AccentTone>(
    profile?.accentTone ?? 'forest'
  );

  const [showCamera, setShowCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showCamera) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, showCamera]);

  async function handleAvatarBlob(blob: Blob) {
    try {
      setError(null);
      const dataUrl = await compressAvatarToDataUrl(blob);
      setAvatarDataUrl(dataUrl);
    } catch {
      setError('Foto gagal diproses. Coba pilih gambar lain.');
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      await handleAvatarBlob(file);
    }
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama anak harus diisi dulu.');
      return;
    }

    setSaving(true);
    setError(null);
    const now = Date.now();
    try {
      const saved: ChildProfile = {
        id: profile?.id ?? createId('anak'),
        name: trimmedName,
        nickname: nickname.trim() || trimmedName,
        birthDate: birthDate.trim(),
        hobby: hobby.trim(),
        favoriteFood: favoriteFood.trim(),
        favoriteColor: favoriteColor.trim(),
        dream: dream.trim(),
        aboutMe: aboutMe.trim(),
        avatarDataUrl,
        accentTone,
        order: profile?.order ?? nextOrder,
        createdAt: profile?.createdAt ?? now,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await onSave(saved);
      onClose();
    } catch {
      setError('Gagal menyimpan profil. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!profile || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(profile);
      onClose();
    } catch {
      setError('Gagal menghapus profil.');
      setSaving(false);
    }
  }

  const initials = (name.trim() || 'AK').slice(0, 2).toUpperCase();
  const activeSwatch =
    ACCENT_OPTIONS.find((o) => o.id === accentTone)?.swatch ?? '#2B6A58';

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#2C221C]/55 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="notebook-card rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 bg-parchment/75 border-b border-rule flex items-center justify-between">
            <div>
              <h2 id="profile-modal-title" className="text-xl font-bold text-ink">
                {isEditing ? `Biodata Buku ${profile?.name}` : 'Tambah Akun Anak Baru'}
              </h2>
              <p className="text-xs font-semibold text-walnut mt-0.5">
                Isi biodata seperti halaman depan buku harian anak. Semua bisa diubah kapan saja.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[42px] min-h-[42px] rounded-xl border border-rule bg-paper text-ink hover:border-rule-strong flex items-center justify-center cursor-pointer"
              aria-label="Tutup form biodata"
            >
              <CloseCrossIcon className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto warm-scroll p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-danger text-danger text-sm font-bold">
                {error}
              </div>
            )}

            {/* Photo & Cover Tone Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center pb-5 border-b border-rule">
              <div className="md:col-span-7 flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border-2 border-rule text-white font-display text-2xl font-bold"
                  style={{ backgroundColor: avatarDataUrl ? '#FFFDF8' : activeSwatch }}
                >
                  {avatarDataUrl ? (
                    <img
                      src={avatarDataUrl}
                      alt={`Foto ${name || 'profil'}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-bold text-ink">Foto Profil</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 min-h-[40px] rounded-xl border border-rule-strong bg-paper text-ink text-xs font-bold flex items-center gap-1.5 hover:bg-cream cursor-pointer"
                    >
                      <GalleryPhotoIcon className="w-4 h-4" />
                      <span>Pilih Galeri</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="px-3 py-2 min-h-[40px] rounded-xl border border-rule-strong bg-paper text-ink text-xs font-bold flex items-center gap-1.5 hover:bg-cream cursor-pointer"
                    >
                      <CameraLensIcon className="w-4 h-4" />
                      <span>Ambil Selfie</span>
                    </button>
                    {parentMode && avatarDataUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarDataUrl(undefined)}
                        className="px-3 py-2 min-h-[40px] rounded-xl border border-rule text-walnut text-xs font-bold hover:text-danger cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>

              <div className="md:col-span-5 space-y-2">
                <div className="text-sm font-bold text-ink">Warna Sampul Buku</div>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_OPTIONS.map((opt) => {
                    const selected = accentTone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAccentTone(opt.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                          selected
                            ? 'border-ink bg-parchment text-ink'
                            : 'border-rule bg-paper text-walnut hover:border-rule-strong'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: opt.swatch }}
                        />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Biodata Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Nama Lengkap / Tampilan *
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Umar"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Nama Panggilan
                </span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nama panggilan sehari-hari"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Tanggal Lahir
                </span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Hobi Kesukaan
                </span>
                <input
                  type="text"
                  value={hobby}
                  onChange={(e) => setHobby(e.target.value)}
                  placeholder="Contoh: Menggambar, bersepeda, main lego"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Makanan Favorit
                </span>
                <input
                  type="text"
                  value={favoriteFood}
                  onChange={(e) => setFavoriteFood(e.target.value)}
                  placeholder="Contoh: Nasi goreng, ayam bakar"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Warna Favorit
                </span>
                <input
                  type="text"
                  value={favoriteColor}
                  onChange={(e) => setFavoriteColor(e.target.value)}
                  placeholder="Contoh: Hijau, biru tua"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Cita-cita
                </span>
                <input
                  type="text"
                  value={dream}
                  onChange={(e) => setDream(e.target.value)}
                  placeholder="Ingin menjadi apa saat besar nanti?"
                  className="w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold"
                />
              </label>

              <label className="block space-y-1.5 md:col-span-2">
                <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
                  Tentang Aku
                </span>
                <textarea
                  rows={2}
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder="Tulis kalimat singkat tentang dirimu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rule-strong bg-paper text-ink text-sm font-semibold resize-none"
                />
              </label>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-3">
              <div>
                {parentMode && isEditing && canDelete && onDelete && !confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule text-danger text-xs font-bold flex items-center gap-1.5 hover:bg-[#FDF2F2] cursor-pointer"
                  >
                    <TrashBinIcon className="w-4 h-4" />
                    <span>Hapus Akun Ini</span>
                  </button>
                )}
                {parentMode && confirmDelete && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-danger">Yakin hapus profil ini?</span>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={saving}
                      className="px-3 py-2 rounded-lg bg-danger text-white text-xs font-bold cursor-pointer"
                    >
                      Ya, Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 rounded-lg border border-rule text-xs font-bold text-ink cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showCamera && (
        <CameraModal
          title="Ambil Foto Profil"
          onCapture={(blob) => {
            setShowCamera(false);
            handleAvatarBlob(blob);
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  );
}
