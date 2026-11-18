import { useEffect, useRef, useState } from 'react';
import { verifyParentPassword } from '../lib/parentMode';
import { CloseCrossIcon, LockShieldIcon } from './Icons';

interface ParentModeModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function ParentModeModal({ onSuccess, onClose }: ParentModeModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verifyParentPassword(password)) {
      setError(null);
      onSuccess();
      onClose();
      return;
    }
    setError('Kata sandi orang tua salah. Silakan coba lagi.');
    inputRef.current?.select();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221C]/55 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-mode-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="notebook-card rounded-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 bg-parchment/75 border-b border-rule flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-forest text-white flex items-center justify-center shrink-0">
              <LockShieldIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 id="parent-mode-title" className="text-lg font-bold text-ink">
                Masuk Mode Orang Tua
              </h2>
              <p className="text-xs font-semibold text-walnut">
                Diperlukan untuk menghapus cerita, media, atau akun anak.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-rule bg-paper text-ink hover:border-rule-strong flex items-center justify-center cursor-pointer"
            aria-label="Tutup dialog mode orang tua"
          >
            <CloseCrossIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wide text-walnut">
              Kata Sandi Orang Tua
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Masukkan kata sandi..."
                className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="px-3 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-cream text-ink text-xs font-bold hover:bg-parchment cursor-pointer"
              >
                {showPassword ? 'Sembunyi' : 'Lihat'}
              </button>
            </div>
          </label>

          {error && (
            <div className="p-3 rounded-xl bg-[#FDF2F2] border border-danger text-danger text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover cursor-pointer"
            >
              Aktifkan Mode Orang Tua
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
