import { jsPDF } from 'jspdf';
import type { ChildProfile, CreativeStory, JournalEntry, AccentTone } from '../types';
import { formatDateLongID, formatDateShortID, formatDuration } from './date';
import { blobToDataUrl, getImageDimensions } from './media';
import { ensureMediaBlobAvailable } from './sync';
import { filterEntriesByDateRange } from './exportWord';

const TONE_HEX: Record<AccentTone, [number, number, number]> = {
  forest: [43, 106, 88],      // #2B6A58
  terracotta: [179, 68, 35],  // #B34423
  ochre: [140, 98, 28],       // #8C621C
  slate: [59, 85, 104],       // #3B5568
};

export interface ExportDiaryPdfOptions {
  child: ChildProfile;
  entries: JournalEntry[];
  startDate: string;
  endDate: string;
}

/**
 * Exports Diary (Buku Harian) entries to a clean, printable PDF file.
 */
export async function exportDiaryToPdf(options: ExportDiaryPdfOptions): Promise<string> {
  const { child, entries, startDate, endDate } = options;
  const filtered = filterEntriesByDateRange(entries, startDate, endDate);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174 mm
  const pageBottomLimit = 270;
  let y = 24;

  const toneRgb = TONE_HEX[child.accentTone] ?? [43, 106, 88];

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageBottomLimit) {
      doc.addPage();
      y = 22;
    }
  }

  // --- Document Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2]);
  doc.text(`Buku Harian ${child.name}`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(95, 81, 71);
  doc.text(
    `Periode: ${formatDateShortID(startDate)} sampai ${formatDateShortID(endDate)} (${filtered.length} cerita)`,
    pageWidth / 2,
    y,
    { align: 'center' }
  );
  y += 10;

  // Divider
  doc.setDrawColor(217, 204, 184);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, marginX + contentWidth, y);
  y += 8;

  // --- Biodata Penulis (if any filled) ---
  const bioLines: string[] = [];
  if (child.nickname && child.nickname !== child.name) bioLines.push(`Panggilan: ${child.nickname}`);
  if (child.birthDate) bioLines.push(`Tanggal Lahir: ${formatDateShortID(child.birthDate)}`);
  if (child.hobby) bioLines.push(`Hobi: ${child.hobby}`);
  if (child.favoriteFood) bioLines.push(`Makanan Favorit: ${child.favoriteFood}`);
  if (child.favoriteColor) bioLines.push(`Warna Favorit: ${child.favoriteColor}`);
  if (child.dream) bioLines.push(`Cita-cita: ${child.dream}`);
  if (child.aboutMe) bioLines.push(`Tentang Aku: ${child.aboutMe}`);

  if (bioLines.length > 0) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(44, 34, 28);
    doc.text('Biodata Penulis', marginX, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(95, 81, 71);

    for (const line of bioLines) {
      checkPageBreak(6);
      doc.text(line, marginX + 2, y);
      y += 5.5;
    }

    y += 3;
    doc.setDrawColor(217, 204, 184);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 8;
  }

  // --- Entries ---
  for (const entry of filtered) {
    checkPageBreak(25);

    // Entry Date Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2]);
    doc.text(formatDateLongID(entry.dateKey), marginX, y);
    y += 7;

    // Entry Content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(44, 34, 28);

    const paragraphs = entry.content.split(/\r?\n/);
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) {
        y += 4;
        continue;
      }
      const wrappedLines = doc.splitTextToSize(paragraph, contentWidth);
      for (const line of wrappedLines) {
        checkPageBreak(6);
        doc.text(line, marginX, y);
        y += 5.5;
      }
      y += 2.5;
    }

    // Attached Photos
    const photos = entry.attachments.filter((a) => a.type === 'photo');
    for (const photo of photos) {
      const blob = await ensureMediaBlobAvailable(photo);
      if (!blob) continue;

      try {
        const [dataUrl, dims] = await Promise.all([
          blobToDataUrl(blob),
          getImageDimensions(blob),
        ]);

        const maxPhotoW = 140; // mm
        const maxPhotoH = 90;  // mm
        let photoW = dims.width * 0.264583;
        let photoH = dims.height * 0.264583;

        const scaleW = photoW > maxPhotoW ? maxPhotoW / photoW : 1;
        const scaleH = photoH > maxPhotoH ? maxPhotoH / photoH : 1;
        const scale = Math.min(scaleW, scaleH);

        photoW = Math.round(photoW * scale);
        photoH = Math.round(photoH * scale);

        checkPageBreak(photoH + 8);

        const photoX = marginX + (contentWidth - photoW) / 2;
        doc.addImage(dataUrl, 'JPEG', photoX, y, photoW, photoH);
        y += photoH + 6;
      } catch {
        checkPageBreak(8);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(130, 120, 110);
        doc.text('[Foto tidak dapat dimuat ke PDF]', marginX, y);
        y += 6;
      }
    }

    // Voice Notes Note
    const voices = entry.attachments.filter((a) => a.type === 'voice');
    if (voices.length > 0) {
      checkPageBreak(8);
      const durations = voices.map((v) => formatDuration(v.durationSec)).join(', ');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2]);
      doc.text(
        `Catatan: Terdapat ${voices.length} rekaman suara (${durations}) tersimpan di aplikasi Buku Harian Ku.`,
        marginX,
        y
      );
      y += 6;
    }

    // Entry Divider
    y += 4;
    checkPageBreak(6);
    doc.setDrawColor(230, 220, 205);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 8;
  }

  // --- Page Numbering Footers ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(140, 130, 120);
    doc.text(
      `Buku Harian ${child.name}  •  Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      288,
      { align: 'center' }
    );
  }

  const safeName = child.name.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const fileName = `Buku-Harian-${safeName}-${startDate}-sd-${endDate}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Exports a Creative Story (Buku Cerita) to a clean, book-formatted PDF.
 */
export async function exportStoryToPdf(story: CreativeStory, author: ChildProfile): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2; // 174 mm
  const pageBottomLimit = 270;
  let y = 30;

  const toneRgb = TONE_HEX[story.coverTone] ?? [43, 106, 88];

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageBottomLimit) {
      doc.addPage();
      y = 22;
    }
  }

  // --- COVER / TITLE BLOCK ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2]);
  doc.text(story.title || 'Buku Cerita', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(95, 81, 71);
  doc.text(`Ditulis oleh: ${author.name}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Synopsis Box
  if (story.synopsis) {
    doc.setDrawColor(toneRgb[0], toneRgb[1], toneRgb[2]);
    doc.setLineWidth(0.4);

    const synLines = doc.splitTextToSize(story.synopsis, contentWidth - 16);
    const boxHeight = synLines.length * 5.5 + 16;

    // Draw light box background & border
    doc.setFillColor(248, 245, 239);
    doc.roundedRect(marginX, y, contentWidth, boxHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2]);
    doc.text('Sinopsis Cerita:', marginX + 6, y + 7);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(60, 50, 45);

    let synY = y + 13;
    for (const sLine of synLines) {
      doc.text(sLine, marginX + 6, synY);
      synY += 5.5;
    }

    y += boxHeight + 10;
  }

  // Table of Chapters Overview
  const sortedChapters = [...(story.chapters || [])].sort((a, b) => a.order - b.order);
  if (sortedChapters.length > 0) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(95, 81, 71);
    doc.text(`Daftar Isi (${sortedChapters.length} Bab):`, marginX, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 50, 45);
    for (const chap of sortedChapters) {
      checkPageBreak(6);
      doc.text(`• Bab ${chap.order}: ${chap.title || 'Tanpa Judul'}`, marginX + 4, y);
      y += 5.5;
    }
    y += 8;
  }

  // --- CHAPTERS (Each chapter starts on a fresh section / page) ---
  for (let idx = 0; idx < sortedChapters.length; idx++) {
    const chap = sortedChapters[idx];

    // New page for each chapter to give real book feel
    doc.addPage();
    y = 26;

    // Chapter Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(toneRgb[0], toneRgb[1], toneRgb[2]);
    doc.text(`Bab ${chap.order}: ${chap.title || 'Tanpa Judul'}`, marginX, y);
    y += 6;

    doc.setDrawColor(217, 204, 184);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 8;

    // Chapter Content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(44, 34, 28);

    const paragraphs = (chap.content || '').split(/\r?\n/);
    for (const p of paragraphs) {
      if (!p.trim()) {
        y += 4;
        continue;
      }
      const wrapped = doc.splitTextToSize(p, contentWidth);
      for (const line of wrapped) {
        checkPageBreak(6.5);
        doc.text(line, marginX, y);
        y += 6;
      }
      y += 3;
    }

    // Chapter Photos
    const photos = (chap.attachments || []).filter((a) => a.type === 'photo');
    for (const photo of photos) {
      const blob = await ensureMediaBlobAvailable(photo);
      if (!blob) continue;

      try {
        const [dataUrl, dims] = await Promise.all([
          blobToDataUrl(blob),
          getImageDimensions(blob),
        ]);

        const maxPhotoW = 145; // mm
        const maxPhotoH = 95;  // mm
        let photoW = dims.width * 0.264583;
        let photoH = dims.height * 0.264583;

        const scaleW = photoW > maxPhotoW ? maxPhotoW / photoW : 1;
        const scaleH = photoH > maxPhotoH ? maxPhotoH / photoH : 1;
        const scale = Math.min(scaleW, scaleH);

        photoW = Math.round(photoW * scale);
        photoH = Math.round(photoH * scale);

        checkPageBreak(photoH + 8);

        const photoX = marginX + (contentWidth - photoW) / 2;
        doc.addImage(dataUrl, 'JPEG', photoX, y, photoW, photoH);
        y += photoH + 6;
      } catch {
        checkPageBreak(8);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(130, 120, 110);
        doc.text('[Foto bab tidak dapat dimuat ke PDF]', marginX, y);
        y += 6;
      }
    }
  }

  // --- Page Numbering Footers ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(140, 130, 120);
    doc.text(
      `${story.title || 'Buku Cerita'}  •  Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      288,
      { align: 'center' }
    );
  }

  const safeTitle = (story.title || 'Buku-Cerita').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const fileName = `Buku-Cerita-${safeTitle}.pdf`;
  doc.save(fileName);
  return fileName;
}
