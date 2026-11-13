import { describe, expect, it } from 'vitest';
import {
  addMonths,
  daysBetween,
  formatDate,
  formatDateTime,
  nowIso,
  warrantyExpiryDate,
} from './date';

describe('date', () => {
  it('formats valid and invalid dates', () => {
    expect(formatDate(new Date(2026, 0, 15))).toBe('15 Jan 2026');
    expect(formatDateTime(new Date(2026, 0, 15, 10, 30))).toContain(
      '15 Jan 2026',
    );
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('adds months while clamping to the last valid day', () => {
    const jan31 = new Date(2026, 0, 31);
    const feb = addMonths(jan31, 1);
    expect(feb.getMonth()).toBe(1);
    expect(feb.getDate()).toBe(28);

    const leap = addMonths(new Date(2028, 0, 31), 1);
    expect(leap.getMonth()).toBe(1);
    expect(leap.getDate()).toBe(29);
  });

  it('returns null for zero or invalid warranty months', () => {
    expect(warrantyExpiryDate(new Date(2026, 0, 15), 0)).toBeNull();
    expect(warrantyExpiryDate(new Date(2026, 0, 15), -1)).toBeNull();
    expect(warrantyExpiryDate(new Date(2026, 0, 15), Number.NaN)).toBeNull();
  });

  it('calculates warranty expiry', () => {
    const expiry = warrantyExpiryDate(new Date(2026, 0, 15), 12);
    expect(expiry).not.toBeNull();
    expect(new Date(expiry as string).getFullYear()).toBe(2027);
  });

  it('counts calendar days between dates', () => {
    expect(
      daysBetween(new Date(2026, 0, 1, 12), new Date(2026, 0, 3, 12)),
    ).toBe(2);
    expect(
      daysBetween(new Date(2026, 0, 3, 12), new Date(2026, 0, 1, 12)),
    ).toBe(-2);
  });

  it('creates an ISO timestamp', () => {
    expect(Number.isNaN(new Date(nowIso()).getTime())).toBe(false);
  });
});
