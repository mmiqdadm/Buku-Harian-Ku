import { useEffect, useState } from 'react';
import type { MediaAttachment } from '../types';
import { formatDuration } from '../lib/date';
import { ensureMediaBlobAvailable } from '../lib/sync';
import { CloseCrossIcon, TrashBinIcon, VoiceMicIcon } from './Icons';

interface MediaItemProps {
  attachment: MediaAttachment;
  editable?: boolean;
  onRemove?: (id: string) => void;
}

function MediaItemCard({ attachment, editable, onRemove }: MediaItemProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    async function load() {
      setLoading(true);
      const blob = await ensureMediaBlobAvailable(attachment);
      if (!active) return;
      if (blob) {
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } else {
        setObjectUrl(null);
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  if (attachment.type === 'photo') {
    return (
      <>
        <div className="relative group rounded-xl overflow-hidden border border-rule bg-cream w-36 h-28 shrink-0">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-walnut">
              Memuat foto...
            </div>
          ) : objectUrl ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="w-full h-full block cursor-pointer"
              aria-label="Lihat foto lebih besar"
            >
              <img
                src={objectUrl}
                alt={attachment.caption || 'Lampiran foto cerita'}
                className="w-full h-full object-cover"
              />
            </button>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-center p-2 text-xs font-semibold text-walnut">
              Foto butuh internet untuk dimuat
            </div>
          )}

          {editable && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="absolute top-1.5 right-1.5 w-8 h-8 rounded-lg bg-[#2C221C]/85 text-white flex items-center justify-center hover:bg-danger cursor-pointer"
              aria-label="Hapus foto ini"
            >
              <TrashBinIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {lightboxOpen && objectUrl && (
          <div
            className="fixed inset-0 z-50 bg-[#2C221C]/80 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Pratinjau foto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setLightboxOpen(false);
            }}
          >
            <div className="relative max-w-4xl max-h-[88vh] flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-paper text-ink text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CloseCrossIcon className="w-4 h-4" />
                <span>Tutup Foto</span>
              </button>
              <img
                src={objectUrl}
                alt={attachment.caption || 'Lampiran foto cerita'}
                className="max-h-[80vh] max-w-full rounded-xl border-2 border-paper object-contain bg-paper"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Voice Note Card
  return (
    <div className="rounded-xl border border-rule bg-parchment/55 px-3.5 py-2.5 flex items-center gap-3 min-w-[260px] max-w-full">
      <div className="w-9 h-9 rounded-lg bg-forest text-white flex items-center justify-center shrink-0">
        <VoiceMicIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-ink">
          <span>Rekaman Suara</span>
          <span className="text-walnut">{formatDuration(attachment.durationSec)}</span>
        </div>
        {loading ? (
          <div className="text-xs font-semibold text-walnut">Memuat suara...</div>
        ) : objectUrl ? (
          <audio controls src={objectUrl} className="w-full h-8" preload="metadata" />
        ) : (
          <div className="text-xs font-semibold text-walnut">
            Rekaman butuh internet untuk dimuat
          </div>
        )}
      </div>
      {editable && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="w-9 h-9 rounded-lg border border-rule bg-paper text-danger hover:bg-[#FDF2F2] flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Hapus rekaman suara ini"
        >
          <TrashBinIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface MediaGalleryProps {
  attachments: MediaAttachment[];
  editable?: boolean;
  onRemove?: (id: string) => void;
}

export function MediaGallery({ attachments, editable = false, onRemove }: MediaGalleryProps) {
  if (attachments.length === 0) return null;

  const photos = attachments.filter((a) => a.type === 'photo');
  const voices = attachments.filter((a) => a.type === 'voice');

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => (
            <MediaItemCard
              key={photo.id}
              attachment={photo}
              editable={editable}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      {voices.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {voices.map((voice) => (
            <MediaItemCard
              key={voice.id}
              attachment={voice}
              editable={editable}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
