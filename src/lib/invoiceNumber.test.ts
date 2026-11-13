import { describe, expect, it } from 'vitest';
import {
  formatInvoiceNumber,
  parseInvoiceSequence,
} from './invoiceNumber';

describe('invoice numbers', () => {
  it('formats sequences with a prefix and padding', () => {
    expect(formatInvoiceNumber('INV-2026-', 7)).toBe('INV-2026-0007');
    expect(formatInvoiceNumber('INV-2026-', 0)).toBe('INV-2026-0001');
    expect(formatInvoiceNumber('A/', 12, 2)).toBe('A/12');
  });

  it('parses a sequence from a matching invoice number', () => {
    expect(parseInvoiceSequence('INV-2026-0007', 'INV-2026-')).toBe(7);
    expect(parseInvoiceSequence('INV-2026-0000', 'INV-2026-')).toBeNull();
    expect(parseInvoiceSequence('INV-2025-0007', 'INV-2026-')).toBeNull();
    expect(parseInvoiceSequence('INV-2026-AB12', 'INV-2026-')).toBeNull();
  });
});
