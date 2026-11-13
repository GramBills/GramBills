import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { productsToCsv } from '../lib/csv';
import { emptyProductForm } from '../lib/productValidation';
import type { ProductForm } from '../types/pos';
import {
  createProduct,
  deleteProduct,
  generateBarcodeForProduct,
  generateMissingBarcodes,
  importProductsFromCsv,
  stockInProduct,
  updateProduct,
} from './products';

function form(overrides: Partial<ProductForm> = {}): ProductForm {
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
    lowStockThreshold: 3,
    defaultWarrantyMonths: 12,
    rackLocation: 'Rack A',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
  db.close();
});

describe('product service', () => {
  it('creates a product with generated SKU and opening stock', async () => {
    const product = await createProduct(form());

    expect(product.skuCode).toBe('ELEC-1001');
    expect(product.barcode).toBe('');
    expect(product.stockQty).toBe(10);
    expect(product.syncStatus).toBe('pending');

    const movements = await db.stockMovements.toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0].changeType).toBe('opening_stock');
    expect(movements[0].qtyChange).toBe(10);
  });

  it('rejects duplicate barcodes', async () => {
    await createProduct(form({ barcode: '8902670100011' }));
    await expect(
      createProduct(form({ name: 'Another bulb', barcode: '8902670100011' })),
    ).rejects.toThrow('already used');
  });

  it('updates catalog fields without changing stock', async () => {
    const product = await createProduct(form());
    const updated = await updateProduct(product.id, {
      ...form({ name: 'Updated bulb', sellingPrice: 105, stockQty: 999 }),
    });

    expect(updated.name).toBe('Updated bulb');
    expect(updated.sellingPrice).toBe(105);
    expect(updated.stockQty).toBe(10);
  });

  it('logs purchase stock-in and updates cost', async () => {
    const product = await createProduct(form({ stockQty: 5 }));
    const updated = await stockInProduct({
      productId: product.id,
      quantity: 7,
      purchasePrice: 60,
      reference: 'SUP-123',
    });

    expect(updated.stockQty).toBe(12);
    expect(updated.purchasePrice).toBe(60);

    const movements = await db.stockMovements.toArray();
    const purchase = movements.find(
      (movement) => movement.changeType === 'purchase_in',
    );
    expect(purchase?.qtyChange).toBe(7);
    expect(purchase?.referenceId).toBe('SUP-123');
  });

  it('generates sequential custom barcodes', async () => {
    const first = await createProduct(form({ barcode: '' }));
    const second = await createProduct(
      form({ name: 'Second bulb', barcode: '' }),
    );

    expect(await generateBarcodeForProduct(first.id)).toBe('SKU0001001');
    const generated = await generateMissingBarcodes([second.id]);
    expect(generated.get(second.id)).toBe('SKU0001002');

    const stored = await db.products.get(second.id);
    expect(stored?.isCustomBarcode).toBe(true);
  });

  it('soft-deletes products', async () => {
    const product = await createProduct(form());
    await deleteProduct(product.id);

    const stored = await db.products.get(product.id);
    expect(stored?.deletedAt).toBeTruthy();
  });

  it('imports a CSV export as new products', async () => {
    const product = await createProduct(form({ barcode: 'SKU0001001' }));
    const csv = productsToCsv([product]);

    await db.products.clear();
    await db.stockMovements.clear();

    const result = await importProductsFromCsv(csv);

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([]);
    const imported = await db.products.toCollection().first();
    expect(imported?.name).toBe(product.name);
    expect(imported?.stockQty).toBe(10);
    const movements = await db.stockMovements.toArray();
    expect(movements[0].changeType).toBe('opening_stock');
  });

  it('updates an existing SKU without overwriting stock', async () => {
    const product = await createProduct(form({ stockQty: 4 }));
    const csv = productsToCsv([
      { ...product, name: 'CSV updated bulb', stockQty: 99 },
    ]);

    const result = await importProductsFromCsv(csv);

    expect(result.updated).toBe(1);
    const stored = await db.products.get(product.id);
    expect(stored?.name).toBe('CSV updated bulb');
    expect(stored?.stockQty).toBe(4);
  });
});
