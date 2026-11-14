import { daysBetween } from './date';

export type WarrantyStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'not_covered';

export interface WarrantyInfo {
  status: WarrantyStatus;
  daysRemaining: number | null;
  label: string;
}

export function getWarrantyInfo(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): WarrantyInfo {
  if (!expiryDate) {
    return { status: 'not_covered', daysRemaining: null, label: 'No warranty' };
  }
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return { status: 'not_covered', daysRemaining: null, label: 'No warranty' };
  }

  const daysRemaining = daysBetween(now, expiry);
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return {
      status: 'expired',
      daysRemaining,
      label: `Expired ${days} day${days === 1 ? '' : 's'} ago`,
    };
  }
  if (daysRemaining <= 30) {
    return {
      status: 'expiring_soon',
      daysRemaining,
      label:
        daysRemaining === 0
          ? 'Expires today'
          : `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
    };
  }
  return {
    status: 'active',
    daysRemaining,
    label: `Active · ${daysRemaining} days left`,
  };
}
