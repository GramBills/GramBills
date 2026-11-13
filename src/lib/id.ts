export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeBarcode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function formatCustomBarcode(sequence: number): string {
  const safeSequence = Math.max(1, Math.trunc(sequence));
  return `SKU${String(safeSequence).padStart(7, '0')}`;
}

export function nextCustomBarcode(existingBarcodes: Iterable<string>): string {
  let highest = 1000;
  for (const barcode of existingBarcodes) {
    const match = /^SKU(\d{7})$/.exec(barcode.trim());
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return formatCustomBarcode(highest + 1);
}

export function nextSkuCode(existingSkuCodes: Iterable<string>): string {
  let highest = 1000;
  for (const sku of existingSkuCodes) {
    const match = /^ELEC-(\d+)$/.exec(sku.trim());
    if (match) {
      highest = Math.max(highest, Number(match[1]));
    }
  }
  return `ELEC-${highest + 1}`;
}
