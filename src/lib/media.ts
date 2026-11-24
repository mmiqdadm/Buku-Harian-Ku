/**
 * Media compression and conversion utilities.
 *
 * Optimizations:
 * 1. WebP format: 25%-35% lighter than JPEG at equivalent visual quality.
 * 2. Max dimension 720px: Sweet spot for tablet/phone retina displays and A4 printouts.
 * 3. Quality 0.65: Maximum file size savings without perceptible artifacting.
 */

export async function compressImageBlob(
  input: Blob,
  maxDimension = 720,
  quality = 0.65
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

    // Try WebP first; fallback to JPEG if toBlob('image/webp') is unsupported
    let blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (!blob || blob.type !== 'image/webp') {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality)
      );
    }
    if (!blob) throw new Error('Gagal memproses gambar.');
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function compressAvatarToDataUrl(input: Blob): Promise<string> {
  const blob = await compressImageBlob(input, 240, 0.70);
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

/**
 * Ensures an image Blob is in a format accepted by Microsoft Word (.docx),
 * converting WebP to JPEG on-the-fly when exporting.
 */
export async function ensureDocxImageBuffer(
  blob: Blob
): Promise<{ buffer: ArrayBuffer; type: 'jpg' | 'png' }> {
  if (blob.type === 'image/png') {
    return { buffer: await blob.arrayBuffer(), type: 'png' };
  }
  if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
    return { buffer: await blob.arrayBuffer(), type: 'jpg' };
  }

  // Convert WebP / other format to JPEG
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas tidak tersedia');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const jpgBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!jpgBlob) throw new Error('Gagal mengonversi gambar untuk Word');
    return { buffer: await jpgBlob.arrayBuffer(), type: 'jpg' };
  } finally {
    bitmap.close();
  }
}

/**
 * Ensures an image Blob produces a JPEG DataURL for 100% universal PDF rendering in jsPDF.
 */
export async function ensureJpegDataUrl(blob: Blob): Promise<string> {
  if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
    return blobToDataUrl(blob);
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blobToDataUrl(blob);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    bitmap.close();
  }
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
