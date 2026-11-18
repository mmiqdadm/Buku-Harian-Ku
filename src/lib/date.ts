const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date YYYY-MM-DD (never UTC-shifted) */
export function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Local month key YYYY-MM */
export function getCurrentMonthKey(): string {
  return getTodayDateKey().slice(0, 7);
}

export function getMonthKeyFromDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** e.g. "Rabu, 18 November 2026" */
export function formatDateLongID(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const dayName = DAYS_ID[date.getDay()] ?? '';
  const monthName = MONTHS_ID[date.getMonth()] ?? '';
  return `${dayName}, ${date.getDate()} ${monthName} ${date.getFullYear()}`;
}

/** e.g. "18 Nov 2026" */
export function formatDateShortID(dateKey: string): string {
  const date = parseDateKey(dateKey);
  const monthName = (MONTHS_ID[date.getMonth()] ?? '').slice(0, 3);
  return `${date.getDate()} ${monthName} ${date.getFullYear()}`;
}

/** e.g. "November 2026" */
export function formatMonthYearID(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const monthName = MONTHS_ID[(m || 1) - 1] ?? '';
  return `${monthName} ${y}`;
}

/** e.g. { year: "2026", monthName: "November" } */
export function splitMonthKeyID(monthKey: string): { year: string; monthName: string } {
  const [y, m] = monthKey.split('-').map(Number);
  return {
    year: String(y || ''),
    monthName: MONTHS_ID[(m || 1) - 1] ?? monthKey,
  };
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${pad2(secs)}`;
}

export function formatTimeAgoID(timestamp: number | null): string {
  if (!timestamp) return 'Belum pernah';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]?.slice(0, 3)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
