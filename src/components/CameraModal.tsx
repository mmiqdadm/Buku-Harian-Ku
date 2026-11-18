import { useEffect, useRef, useState } from 'react';
import { CameraLensIcon, CloseCrossIcon, RefreshSyncIcon } from './Icons';

interface CameraModalProps {
  title?: string;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export function CameraModal({
  title = 'Ambil Foto Selfie',
  onCapture,
  onClose,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      setLoading(true);
      setError(null);
      stopTracks();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Browser ini belum mendukung kamera langsung. Kamu bisa pilih foto dari perangkat.');
        setLoading(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setLoading(false);
      } catch {
        if (!active) return;
        setError('Izin kamera belum aktif atau kamera tidak ditemukan. Kamu tetap bisa ambil foto lewat tombol di bawah.');
        setLoading(false);
      }
    }

    startCamera();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKey);
      stopTracks();
    };
  }, [facingMode, onClose]);

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function handleSnap() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopTracks();
          onCapture(blob);
        }
      },
      'image/jpeg',
      0.85
    );
  }

  function handleFallbackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      stopTracks();
      onCapture(file);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221C]/65 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="notebook-card rounded-2xl w-full max-w-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between bg-parchment/60">
          <div className="flex items-center gap-2.5">
            <CameraLensIcon className="w-5 h-5 text-forest" />
            <h2 id="camera-modal-title" className="text-lg font-bold text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-rule bg-paper text-ink hover:border-rule-strong flex items-center justify-center cursor-pointer"
            aria-label="Tutup kamera"
          >
            <CloseCrossIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-[#221A15] aspect-video flex items-center justify-center">
            {loading && !error && (
              <p className="text-sm font-semibold text-[#F6EFE2]">Menyiapkan kamera...</p>
            )}
            {error && (
              <div className="p-6 text-center space-y-3 max-w-sm">
                <p className="text-sm text-[#F6EFE2] leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-terracotta text-white text-sm font-bold hover:bg-terracotta-hover cursor-pointer"
                >
                  Buka Kamera Perangkat / Galeri
                </button>
              </div>
            )}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''} ${
                loading || error ? 'hidden' : 'block'
              }`}
            />
          </div>

          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFallbackFile}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
              disabled={Boolean(error)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule-strong bg-paper text-ink text-sm font-bold flex items-center gap-2 disabled:opacity-45 cursor-pointer"
            >
              <RefreshSyncIcon className="w-4 h-4" />
              <span>{facingMode === 'user' ? 'Pakai Kamera Belakang' : 'Pakai Kamera Selfie'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-rule bg-paper text-walnut text-sm font-bold hover:border-rule-strong cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSnap}
                disabled={loading || Boolean(error)}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-forest text-white text-sm font-bold hover:bg-forest-hover disabled:opacity-45 flex items-center gap-2 cursor-pointer"
              >
                <CameraLensIcon className="w-4 h-4" />
                <span>Jepret Foto</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
