import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';
import type { AccentTone, ChildProfile, CreativeStory, JournalEntry } from '../types';
import { formatDateLongID, formatDateShortID, formatDuration } from './date';
import { blobToArrayBuffer, getImageDimensions } from './media';
import { ensureMediaBlobAvailable } from './sync';

const TONE_COLOR: Record<AccentTone, string> = {
  forest: '2B6A58',
  terracotta: 'B34423',
  ochre: '8C621C',
  slate: '3B5568',
};

export interface ExportOptions {
  child: ChildProfile;
  entries: JournalEntry[];
  startDate: string;
  endDate: string;
}

export function filterEntriesByDateRange(
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

function getDocxImageType(mimeType: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('bmp')) return 'bmp';
  return 'jpg';
}

export async function exportDiaryToWord(options: ExportOptions): Promise<string> {
  const { child, entries, startDate, endDate } = options;
  const filtered = filterEntriesByDateRange(entries, startDate, endDate);

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Buku Harian ${child.name}`,
          bold: true,
          size: 40,
          color: '2B6A58',
          font: 'Georgia',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: `Periode: ${formatDateShortID(startDate)} sampai ${formatDateShortID(endDate)} (${filtered.length} cerita)`,
          size: 22,
          color: '5F5147',
          font: 'Calibri',
        }),
      ],
    }),
  ];

  // Biodata block if the child has filled any biodata fields
  const bioLines: string[] = [];
  if (child.nickname && child.nickname !== child.name) bioLines.push(`Panggilan: ${child.nickname}`);
  if (child.birthDate) bioLines.push(`Tanggal Lahir: ${formatDateShortID(child.birthDate)}`);
  if (child.hobby) bioLines.push(`Hobi: ${child.hobby}`);
  if (child.favoriteFood) bioLines.push(`Makanan Favorit: ${child.favoriteFood}`);
  if (child.favoriteColor) bioLines.push(`Warna Favorit: ${child.favoriteColor}`);
  if (child.dream) bioLines.push(`Cita-cita: ${child.dream}`);
  if (child.aboutMe) bioLines.push(`Tentang Aku: ${child.aboutMe}`);

  if (bioLines.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: 'Biodata Penulis',
            bold: true,
            size: 24,
            color: '2C221C',
            font: 'Georgia',
          }),
        ],
      })
    );
    for (const line of bioLines) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: line,
              size: 21,
              color: '5F5147',
              font: 'Calibri',
            }),
          ],
        })
      );
    }
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        border: {
          bottom: { color: 'D9CCB8', size: 6, style: BorderStyle.SINGLE },
        },
        children: [],
      })
    );
  }

  for (const entry of filtered) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        children: [
          new TextRun({
            text: formatDateLongID(entry.dateKey),
            bold: true,
            size: 26,
            color: '2B6A58',
            font: 'Georgia',
          }),
        ],
      })
    );

    const bodyParagraphs = entry.content.split(/\r?\n/);
    for (const line of bodyParagraphs) {
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 340 },
          children: [
            new TextRun({
              text: line,
              size: 23,
              color: '2C221C',
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // Embed attached photos directly into the Word document
    const photos = entry.attachments.filter((a) => a.type === 'photo');
    for (const photo of photos) {
      const blob = await ensureMediaBlobAvailable(photo);
      if (!blob) continue;
      try {
        const [buffer, dims] = await Promise.all([
          blobToArrayBuffer(blob),
          getImageDimensions(blob),
        ]);
        const maxW = 460;
        const scale = dims.width > maxW ? maxW / dims.width : 1;
        const width = Math.round(dims.width * scale);
        const height = Math.round(dims.height * scale);

        children.push(
          new Paragraph({
            spacing: { before: 100, after: 140 },
            children: [
              new ImageRun({
                data: new Uint8Array(buffer),
                type: getDocxImageType(photo.mimeType),
                transformation: { width, height },
              }),
            ],
          })
        );
      } catch {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '[Lampiran foto tidak dapat dimuat ke dokumen]',
                italics: true,
                size: 20,
                color: '5F5147',
              }),
            ],
          })
        );
      }
    }

    // Mention voice notes cleanly
    const voices = entry.attachments.filter((a) => a.type === 'voice');
    if (voices.length > 0) {
      const durations = voices.map((v) => formatDuration(v.durationSec)).join(', ');
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 120 },
          children: [
            new TextRun({
              text: `Lampiran rekaman suara: ${voices.length} rekaman (durasi ${durations}) tersimpan di aplikasi Buku Harian Ku.`,
              italics: true,
              size: 20,
              color: '2B6A58',
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    children.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        border: {
          bottom: { color: 'D9CCB8', size: 4, style: BorderStyle.SINGLE },
        },
        children: [],
      })
    );
  }

  const doc = new Document({
    creator: 'Buku Harian Ku',
    title: `Buku Harian ${child.name}`,
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = child.name.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const fileName = `Buku-Harian-${safeName}-${startDate}-sd-${endDate}.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return fileName;
}

export async function exportStoryToWord(
  story: CreativeStory,
  author: ChildProfile
): Promise<string> {
  const toneHex = TONE_COLOR[story.coverTone] ?? '2B6A58';
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: story.title || 'Buku Cerita',
          bold: true,
          size: 44,
          color: toneHex,
          font: 'Georgia',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Ditulis oleh: ${author.name}`,
          bold: true,
          size: 24,
          color: '5F5147',
          font: 'Calibri',
        }),
      ],
    }),
  ];

  if (story.synopsis) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 60 },
        children: [
          new TextRun({
            text: 'Sinopsis Cerita',
            bold: true,
            size: 24,
            color: toneHex,
            font: 'Georgia',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160, line: 320 },
        children: [
          new TextRun({
            text: story.synopsis,
            italics: true,
            size: 22,
            color: '40352E',
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 240 },
        border: {
          bottom: { color: 'D9CCB8', size: 6, style: BorderStyle.SINGLE },
        },
        children: [],
      })
    );
  }

  const sortedChapters = [...(story.chapters || [])].sort((a, b) => a.order - b.order);

  for (let idx = 0; idx < sortedChapters.length; idx++) {
    const chap = sortedChapters[idx];

    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 140 },
        children: [
          new TextRun({
            text: `Bab ${chap.order}: ${chap.title || 'Tanpa Judul'}`,
            bold: true,
            size: 32,
            color: toneHex,
            font: 'Georgia',
          }),
        ],
      })
    );

    const paragraphs = (chap.content || '').split(/\r?\n/);
    for (const line of paragraphs) {
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 340 },
          children: [
            new TextRun({
              text: line,
              size: 23,
              color: '2C221C',
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    // Embed chapter photos
    const photos = (chap.attachments || []).filter((a) => a.type === 'photo');
    for (const photo of photos) {
      const blob = await ensureMediaBlobAvailable(photo);
      if (!blob) continue;
      try {
        const [buffer, dims] = await Promise.all([
          blobToArrayBuffer(blob),
          getImageDimensions(blob),
        ]);
        const maxW = 460;
        const scale = dims.width > maxW ? maxW / dims.width : 1;
        const width = Math.round(dims.width * scale);
        const height = Math.round(dims.height * scale);

        children.push(
          new Paragraph({
            spacing: { before: 100, after: 140 },
            children: [
              new ImageRun({
                data: new Uint8Array(buffer),
                type: getDocxImageType(photo.mimeType),
                transformation: { width, height },
              }),
            ],
          })
        );
      } catch {
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '[Lampiran foto bab tidak dapat dimuat ke dokumen]',
                italics: true,
                size: 20,
                color: '5F5147',
              }),
            ],
          })
        );
      }
    }
  }

  const doc = new Document({
    creator: 'Buku Harian Ku',
    title: `${story.title || 'Buku Cerita'} - ${author.name}`,
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = (story.title || 'Buku-Cerita').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const fileName = `Buku-Cerita-${safeTitle}.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return fileName;
}
