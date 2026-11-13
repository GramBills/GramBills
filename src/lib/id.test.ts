import { describe, expect, it } from 'vitest';
import {
  formatCustomBarcode,
  newId,
  nextCustomBarcode,
  nextSkuCode,
  normalizeBarcode,
} from './id';

describe('identifiers and barcodes', () => {
  it('generates unique ids', () => {
    expect(newId()).not.toBe(newId());
  });

  it('normalizes barcodes', () => {
    expect(normalizeBarcode(' 890 2670 100011 ')).toBe('8902670100011');
  });

  it('formats custom barcodes', () => {
    expect(formatCustomBarcode(1000)).toBe('SKU0001000');
    expect(formatCustomBarcode(0)).toBe('SKU0000001');
  });

  it('finds the next custom barcode and SKU', () => {
    expect(
      nextCustomBarcode(['SKU0001005', 'SKU0001002', '8902670100011']),
    ).toBe('SKU0001006');
    expect(nextSkuCode(['ELEC-1005', 'ELEC-1002', 'SKU0001002'])).toBe(
      'ELEC-1006',
    );
  });
});
