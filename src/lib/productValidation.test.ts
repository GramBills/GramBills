import { describe, expect, it } from 'vitest';
import type { ProductForm } from '../types/pos';
import {
  emptyProductForm,
  normalizeProductForm,
  productToForm,
  validateProductForm,
} from './productValidation';

function validForm(): ProductForm {
  return {
    ...emptyProductForm(),
    name: 'Havells 9W LED Bulb',
    nameLocal: 'हैवेल्स 9W एलईडी बल्ब',
    category: 'Lighting',
    brand: 'Havells',
    purchasePrice: 62,
    mrp: 120,
    sellingPrice: 110,
    minSellingPrice: 95,
    stockQty: 10,
    lowStockThreshold: 2,
    defaultWarrantyMonths: 12,
    barcode: '8902670100011',
  };
}

describe('product validation', () => {
  it('accepts a valid product', () => {
    expect(validateProductForm(validForm())).toEqual({});
  });

  it('requires name, category and positive prices', () => {
    const errors = validateProductForm({
      ...validForm(),
      name: 'A',
      category: '',
      mrp: 0,
      sellingPrice: 0,
    });
    expect(errors.name).toBeDefined();
    expect(errors.category).toBeDefined();
    expect(errors.mrp).toBeDefined();
    expect(errors.sellingPrice).toBeDefined();
  });

  it('guards floor price and MRP boundaries', () => {
    const errors = validateProductForm({
      ...validForm(),
      sellingPrice: 130,
      minSellingPrice: 140,
    });
    expect(errors.sellingPrice).toContain('MRP');
    expect(errors.minSellingPrice).toContain('Floor');
  });

  it('rejects invalid stock, warranty and barcode values', () => {
    const errors = validateProductForm({
      ...validForm(),
      stockQty: -1,
      lowStockThreshold: -2,
      defaultWarrantyMonths: 1.5,
      barcode: 'bad@barcode',
    });
    expect(errors.stockQty).toBeDefined();
    expect(errors.lowStockThreshold).toBeDefined();
    expect(errors.defaultWarrantyMonths).toBeDefined();
    expect(errors.barcode).toBeDefined();
  });

  it('normalizes text, barcode and money values', () => {
    const normalized = normalizeProductForm({
      ...validForm(),
      name: '  LED Bulb  ',
      barcode: ' 890 2670 100011 ',
      purchasePrice: 62.129,
      stockQty: 10.555,
      defaultWarrantyMonths: 12.9,
    });
    expect(normalized.name).toBe('LED Bulb');
    expect(normalized.barcode).toBe('8902670100011');
    expect(normalized.purchasePrice).toBe(62.13);
    expect(normalized.stockQty).toBe(10.56);
    expect(normalized.defaultWarrantyMonths).toBe(12);
  });

  it('converts a product into an editable form', () => {
    const form = validForm();
    const product = {
      id: 'product-1',
      shopId: 'shop-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: 'synced' as const,
      isCustomBarcode: false,
      ...form,
    };
    expect(productToForm(product)).toEqual(form);
  });
});
