/**
 * Compresses an image Blob or File to a lightweight JPEG suitable for
 * offline IndexedDB storage, fast Firebase Firestore/Storage sync, and crisp Word export.
 */
export async function compressImageBlob(
  input: Blob,
  maxDimension = 800,
  quality = 0.68
): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  try {
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) throw new Error('Gagal memproses gambar.');
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function compressAvatarToDataUrl(input: Blob): Promise<string> {
  const blob = await compressImageBlob(input, 240, 0.72);
  return blobToDataUrl(blob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca file media.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file media.'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

export function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
