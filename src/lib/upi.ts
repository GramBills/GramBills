export interface UpiPaymentParams {
  pa: string;
  pn: string;
  am: number;
  tn?: string;
  cu?: string;
}

export function buildUpiUri({
  pa,
  pn,
  am,
  tn,
  cu = 'INR',
}: UpiPaymentParams): string {
  const amount = Number.isFinite(am) ? Math.max(0, am).toFixed(2) : '0.00';
  const params = [
    `pa=${encodeURIComponent(pa.trim())}`,
    `pn=${encodeURIComponent(pn.trim())}`,
    `am=${amount}`,
    `cu=${encodeURIComponent(cu)}`,
  ];
  if (tn && tn.trim()) {
    params.push(`tn=${encodeURIComponent(tn.trim())}`);
  }
  return `upi://pay?${params.join('&')}`;
}
