import { describe, expect, it } from 'vitest';
import type { Product } from '../types/pos';
import {
  parseCsv,
  parseProductCsv,
  productCsvTemplate,
  productsToCsv,
  toCsv,
} from './csv';

function product(): Product {
  return {
    id: 'product-1',
    shopId: 'local-shop-01',
    deviceId: 'local-device-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncStatus: 'synced',
    skuCode: 'ELEC-1001',
    barcode: '8902670100011',
    isCustomBarcode: false,
    name: 'Havells 9W LED Bulb, Cool Day Light',
    nameLocal: 'हैवेल्स 9W एलईडी बल्ब',
    category: 'Lighting',
    brand: 'Havells',
    unit: 'pcs',
    purchasePrice: 62,
    mrp: 120,
    sellingPrice: 110,
    minSellingPrice: 95,
    gstRate: 12,
    taxInclusive: true,
    hsnCode: '8539',
    stockQty: 48,
    lowStockThreshold: 10,
    trackSerialImei: false,
    defaultWarrantyMonths: 12,
    rackLocation: 'Rack A - Shelf 1',
  };
}

describe('CSV', () => {
  it('parses quotes, commas, CRLF and a BOM', () => {
    const rows = parseCsv(
      '\uFEFFname,note\r\n"Bulb, 9W","He said ""hello"""\r\n',
    );
    expect(rows).toEqual([
      ['name', 'note'],
      ['Bulb, 9W', 'He said "hello"'],
    ]);
  });

  it('writes and reads quoted values', () => {
    const csv = toCsv([
      ['name', 'note'],
      ['Bulb, 9W', 'He said "hello"'],
    ]);
    expect(parseCsv(csv)).toEqual([
      ['name', 'note'],
      ['Bulb, 9W', 'He said "hello"'],
    ]);
  });

  it('round-trips product rows', () => {
    const source = product();
    const parsed = parseProductCsv(productsToCsv([source]));

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].form).toMatchObject({
      skuCode: 'ELEC-1001',
      barcode: '8902670100011',
      name: source.name,
      nameLocal: source.nameLocal,
      category: 'Lighting',
      brand: 'Havells',
      unit: 'pcs',
      purchasePrice: 62,
      mrp: 120,
      sellingPrice: 110,
      minSellingPrice: 95,
      gstRate: 12,
      taxInclusive: true,
      hsnCode: '8539',
      stockQty: 48,
      lowStockThreshold: 10,
      trackSerialImei: false,
      defaultWarrantyMonths: 12,
      rackLocation: 'Rack A - Shelf 1',
    });
  });

  it('provides a parseable template', () => {
    const parsed = parseProductCsv(productCsvTemplate());
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].form.name).toBe('Sample LED Bulb 9W');
    expect(parsed.rows[0].form.barcode).toBe('SKU0002001');
  });

  it('reports missing headers', () => {
    const parsed = parseProductCsv('name,category\nBulb,Lighting\n');
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]).toContain('Missing required CSV columns');
  });

  it('reports an empty file and unclosed quotes', () => {
    expect(parseProductCsv('').errors).toEqual(['CSV file is empty.']);
    expect(() => parseCsv('name,note\n"unclosed')).toThrow('unclosed');
  });
});
