export function formatInvoiceNumber(
  prefix: string,
  sequence: number,
  pad = 4,
): string {
  const safeSequence = Math.max(1, Math.trunc(sequence));
  return `${prefix}${String(safeSequence).padStart(pad, '0')}`;
}

export function parseInvoiceSequence(
  invoiceNumber: string,
  prefix: string,
): number | null {
  if (!invoiceNumber.startsWith(prefix)) {
    return null;
  }
  const suffix = invoiceNumber.slice(prefix.length);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }
  const sequence = Number(suffix);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}
