export function runAsync(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

export function formatShortCode(id: string): string {
  const compact = id.replace(/[^0-9a-z]/gi, '').toUpperCase();
  return compact.length === 0 ? 'SIN-ID' : compact.slice(0, 4);
}

export function formatUtcTimestamp(isoDate: string | null | undefined): string {
  if (!isoDate || isoDate.trim().length === 0) {
    return 'No registrado';
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const month = monthNames[date.getUTCMonth()] ?? '';
  const year = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm} UTC`;
}

export function formatUtcDateOnly(isoDate: string | null | undefined): string {
  if (!isoDate || isoDate.trim().length === 0) {
    return '—';
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  const month = monthNames[date.getUTCMonth()] ?? '';
  return `${day} ${month} ${date.getUTCFullYear()}`;
}

export function todayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIsoLocal(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);
  if (words.length === 0) return '·';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
