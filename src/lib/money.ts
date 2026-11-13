export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatINR(
  value: number,
  options: { decimals?: number } = {},
): string {
  const decimals = options.decimals ?? 2;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(round2(value));
}

export function formatINR0(value: number): string {
  return formatINR(value, { decimals: 0 });
}

export function calcProfit(sellingPrice: number, purchasePrice: number): number {
  return round2(sellingPrice - purchasePrice);
}

export function calcMarginPercent(
  sellingPrice: number,
  purchasePrice: number,
): number {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return 0;
  }
  return round2(((sellingPrice - purchasePrice) / sellingPrice) * 100);
}
