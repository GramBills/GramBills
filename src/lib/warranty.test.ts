import { describe, expect, it } from 'vitest';
import { getWarrantyInfo } from './warranty';

describe('warranty status', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0);

  it('handles missing and invalid expiry dates', () => {
    expect(getWarrantyInfo(null, now).status).toBe('not_covered');
    expect(getWarrantyInfo('not-a-date', now).status).toBe('not_covered');
  });

  it('detects active, expiring and expired warranties', () => {
    const active = getWarrantyInfo(
      new Date(2027, 5, 15).toISOString(),
      now,
    );
    expect(active.status).toBe('active');
    expect(active.daysRemaining).toBe(365);

    const expiring = getWarrantyInfo(
      new Date(2026, 6, 10).toISOString(),
      now,
    );
    expect(expiring.status).toBe('expiring_soon');
    expect(expiring.label).toBe('Expires in 25 days');

    const expired = getWarrantyInfo(
      new Date(2026, 5, 1).toISOString(),
      now,
    );
    expect(expired.status).toBe('expired');
    expect(expired.label).toBe('Expired 14 days ago');
  });

  it('treats expiry today as expiring soon', () => {
    const info = getWarrantyInfo(new Date(2026, 5, 15).toISOString(), now);
    expect(info.status).toBe('expiring_soon');
    expect(info.label).toBe('Expires today');
  });
});
