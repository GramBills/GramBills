export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function addMonths(value: string | Date, months: number): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const daysInTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(targetDay, daysInTargetMonth));
  return date;
}

export function warrantyExpiryDate(
  purchaseDate: string | Date,
  warrantyMonths: number,
): string | null {
  if (!Number.isFinite(warrantyMonths) || warrantyMonths <= 0) {
    return null;
  }
  return addMonths(purchaseDate, warrantyMonths).toISOString();
}

export function daysBetween(
  from: string | Date,
  to: string | Date = new Date(),
): number {
  const start = typeof from === 'string' ? new Date(from) : from;
  const end = typeof to === 'string' ? new Date(to) : to;
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  ).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    .getTime();
  return Math.floor((endDay - startDay) / 86_400_000);
}
