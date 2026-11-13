import { LOCAL_DEVICE_ID, LOCAL_SHOP_ID } from '../db/constants';
import { db } from '../db/database';
import { nowIso } from '../lib/date';
import { parseProductCsv } from '../lib/csv';
import {
  firstProductError,
  normalizeProductForm,
  validateProductForm,
} from '../lib/productValidation';
import {
  formatCustomBarcode,
  newId,
  nextCustomBarcode,
  nextSkuCode,
  normalizeBarcode,
} from '../lib/id';
import { round2 } from '../lib/money';
import type {
  Product,
  ProductForm,
  StockChangeType,
  StockMovement,
} from '../types/pos';

export interface StockInInput {
  productId: string;
  quantity: number;
  purchasePrice?: number;
  reference?: string;
}

export interface ImportProductsResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const CUSTOM_BARCODE_REGEX = /^SKU\d{7}$/;

function isCustomBarcode(barcode: string): boolean {
  return CUSTOM_BARCODE_REGEX.test(barcode);
}

function requireValidForm(form: ProductForm): ProductForm {
  const cleaned = normalizeProductForm(form);
  const errors = validateProductForm(cleaned);
  if (Object.keys(errors).length > 0) {
    throw new Error(firstProductError(errors));
  }
  return cleaned;
}

function assertUniqueSku(
  products: Product[],
  skuCode: string,
  excludeId?: string,
): void {
  const normalized = skuCode.trim().toUpperCase();
  const duplicate = products.find(
    (product) =>
      product.id !== excludeId &&
      product.skuCode.trim().toUpperCase() === normalized,
  );
  if (duplicate) {
    throw new Error(`SKU ${skuCode} is already used by ${duplicate.name}.`);
  }
}

function assertUniqueBarcode(
  products: Product[],
  barcode: string,
  excludeId?: string,
): void {
  const normalized = normalizeBarcode(barcode);
  if (normalized === '') {
    return;
  }
  const duplicate = products.find(
    (product) =>
      product.id !== excludeId &&
      normalizeBarcode(product.barcode) === normalized,
  );
  if (duplicate) {
    throw new Error(
      `Barcode ${barcode} is already used by ${duplicate.name}.`,
    );
  }
}

function createStockMovement(
  product: Product,
  changeType: StockChangeType,
  qtyChange: number,
  referenceId: string,
  now: string,
): StockMovement {
  return {
    id: newId(),
    shopId: LOCAL_SHOP_ID,
    deviceId: LOCAL_DEVICE_ID,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    productId: product.id,
    changeType,
    qtyChange,
    referenceId,
  };
}

function catalogFields(form: ProductForm): Pick<
  Product,
  | 'barcode'
  | 'isCustomBarcode'
  | 'name'
  | 'nameLocal'
  | 'category'
  | 'brand'
  | 'unit'
  | 'purchasePrice'
  | 'mrp'
  | 'sellingPrice'
  | 'minSellingPrice'
  | 'gstRate'
  | 'taxInclusive'
  | 'hsnCode'
  | 'lowStockThreshold'
  | 'trackSerialImei'
  | 'defaultWarrantyMonths'
  | 'rackLocation'
> {
  return {
    barcode: form.barcode,
    isCustomBarcode: isCustomBarcode(form.barcode),
    name: form.name,
    nameLocal: form.nameLocal,
    category: form.category,
    brand: form.brand,
    unit: form.unit,
    purchasePrice: form.purchasePrice,
    mrp: form.mrp,
    sellingPrice: form.sellingPrice,
    minSellingPrice: form.minSellingPrice,
    gstRate: form.gstRate,
    taxInclusive: form.taxInclusive,
    hsnCode: form.hsnCode,
    lowStockThreshold: form.lowStockThreshold,
    trackSerialImei: form.trackSerialImei,
    defaultWarrantyMonths: form.defaultWarrantyMonths,
    rackLocation: form.rackLocation,
  };
}

export async function createProduct(form: ProductForm): Promise<Product> {
  const cleaned = requireValidForm(form);

  return db.transaction(
    'rw',
    db.products,
    db.stockMovements,
    async () => {
      const products = await db.products.toArray();
      const skuCode =
        cleaned.skuCode || nextSkuCode(products.map((item) => item.skuCode));
      assertUniqueSku(products, skuCode);
      assertUniqueBarcode(products, cleaned.barcode);

      const now = nowIso();
      const product: Product = {
        id: newId(),
        shopId: LOCAL_SHOP_ID,
        deviceId: LOCAL_DEVICE_ID,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        skuCode,
        ...catalogFields(cleaned),
        stockQty: cleaned.stockQty,
      };

      await db.products.add(product);
      if (cleaned.stockQty !== 0) {
        await db.stockMovements.add(
          createStockMovement(
            product,
            'opening_stock',
            cleaned.stockQty,
            'product-create',
            now,
          ),
        );
      }
      return product;
    },
  );
}

export async function updateProduct(
  id: string,
  form: ProductForm,
): Promise<Product> {
  const cleaned = requireValidForm(form);

  return db.transaction('rw', db.products, async () => {
    const current = await db.products.get(id);
    if (!current) {
      throw new Error('Product was not found.');
    }

    const products = await db.products.toArray();
    const skuCode = cleaned.skuCode || current.skuCode;
    assertUniqueSku(products, skuCode, id);
    assertUniqueBarcode(products, cleaned.barcode, id);

    const updated: Product = {
      ...current,
      ...catalogFields(cleaned),
      skuCode,
      updatedAt: nowIso(),
      syncStatus: 'pending',
    };
    await db.products.put(updated);
    return updated;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const current = await db.products.get(id);
  if (!current) {
    throw new Error('Product was not found.');
  }
  await db.products.update(id, {
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    syncStatus: 'pending',
  });
}

export async function stockInProduct(
  input: StockInInput,
): Promise<Product> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Enter a stock quantity greater than zero.');
  }
  if (
    input.purchasePrice !== undefined &&
    (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0)
  ) {
    throw new Error('Purchase price cannot be negative.');
  }

  return db.transaction(
    'rw',
    db.products,
    db.stockMovements,
    async () => {
      const current = await db.products.get(input.productId);
      if (!current) {
        throw new Error('Product was not found.');
      }

      const now = nowIso();
      const quantity = round2(input.quantity);
      const updated: Product = {
        ...current,
        stockQty: round2(current.stockQty + quantity),
        purchasePrice:
          input.purchasePrice === undefined
            ? current.purchasePrice
            : round2(input.purchasePrice),
        updatedAt: now,
        syncStatus: 'pending',
      };

      await db.products.put(updated);
      await db.stockMovements.add(
        createStockMovement(
          updated,
          'purchase_in',
          quantity,
          input.reference?.trim() || 'manual-stock-in',
          now,
        ),
      );
      return updated;
    },
  );
}

export async function generateBarcodeForProduct(
  id: string,
): Promise<string> {
  return db.transaction('rw', db.products, async () => {
    const products = await db.products.toArray();
    const current = products.find((product) => product.id === id);
    if (!current) {
      throw new Error('Product was not found.');
    }
    if (current.barcode.trim() !== '') {
      return current.barcode;
    }

    const barcode = nextCustomBarcode(products.map((item) => item.barcode));
    await db.products.update(id, {
      barcode,
      isCustomBarcode: true,
      updatedAt: nowIso(),
      syncStatus: 'pending',
    });
    return barcode;
  });
}

export async function generateMissingBarcodes(
  productIds?: Iterable<string>,
): Promise<Map<string, string>> {
  const idFilter = productIds ? new Set(productIds) : null;

  return db.transaction('rw', db.products, async () => {
    const products = await db.products.toArray();
    const barcodes = products.map((product) => product.barcode);
    const generated = new Map<string, string>();
    let nextSequence =
      Number(nextCustomBarcode(barcodes).replace('SKU', '')) - 1;

    for (const product of products) {
      if (product.deletedAt || product.barcode.trim() !== '') {
        continue;
      }
      if (idFilter && !idFilter.has(product.id)) {
        continue;
      }
      nextSequence += 1;
      const barcode = formatCustomBarcode(nextSequence);
      barcodes.push(barcode);
      generated.set(product.id, barcode);
      await db.products.update(product.id, {
        barcode,
        isCustomBarcode: true,
        updatedAt: nowIso(),
        syncStatus: 'pending',
      });
    }

    return generated;
  });
}

export async function importProductsFromCsv(
  text: string,
): Promise<ImportProductsResult> {
  const parsed = parseProductCsv(text);
  const errors = [...parsed.errors];
  const validRows: { rowNumber: number; form: ProductForm }[] = [];

  for (const row of parsed.rows) {
    const cleaned = normalizeProductForm(row.form);
    const rowErrors = validateProductForm(cleaned);
    if (Object.keys(rowErrors).length > 0) {
      errors.push(`Row ${row.rowNumber}: ${firstProductError(rowErrors)}`);
    } else {
      validRows.push({ rowNumber: row.rowNumber, form: cleaned });
    }
  }

  if (validRows.length === 0) {
    return {
      created: 0,
      updated: 0,
      skipped: parsed.rows.length,
      errors,
    };
  }

  return db.transaction(
    'rw',
    db.products,
    db.stockMovements,
    async () => {
      const products = await db.products.toArray();
      let created = 0;
      let updated = 0;
      let skipped = parsed.rows.length - validRows.length;

      for (const row of validRows) {
        const { form } = row;
        const existing =
          (form.skuCode
            ? products.find(
                (product) =>
                  product.skuCode.trim().toUpperCase() === form.skuCode,
              )
            : undefined) ??
          (form.barcode
            ? products.find(
                (product) =>
                  normalizeBarcode(product.barcode) === form.barcode,
              )
            : undefined);

        const barcodeConflict =
          form.barcode === ''
            ? undefined
            : products.find(
                (product) =>
                  product.id !== existing?.id &&
                  normalizeBarcode(product.barcode) === form.barcode,
              );
        if (barcodeConflict) {
          errors.push(
            `Row ${row.rowNumber}: barcode ${form.barcode} is already used by ${barcodeConflict.name}.`,
          );
          skipped += 1;
          continue;
        }

        const now = nowIso();

        if (existing) {
          const nextCatalog = catalogFields(form);
          if (form.barcode === '' && existing.barcode !== '') {
            nextCatalog.barcode = existing.barcode;
            nextCatalog.isCustomBarcode = existing.isCustomBarcode;
          }
          const nextProduct: Product = {
            ...existing,
            ...nextCatalog,
            updatedAt: now,
            syncStatus: 'pending',
          };
          await db.products.put(nextProduct);
          const index = products.findIndex(
            (product) => product.id === existing.id,
          );
          if (index >= 0) {
            products[index] = nextProduct;
          }
          updated += 1;
          continue;
        }

        const skuCode =
          form.skuCode ||
          nextSkuCode(products.map((product) => product.skuCode));
        if (
          products.some(
            (product) =>
              product.skuCode.trim().toUpperCase() === skuCode.toUpperCase(),
          )
        ) {
          errors.push(`Row ${row.rowNumber}: SKU ${skuCode} already exists.`);
          skipped += 1;
          continue;
        }

        const product: Product = {
          id: newId(),
          shopId: LOCAL_SHOP_ID,
          deviceId: LOCAL_DEVICE_ID,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending',
          skuCode,
          ...catalogFields(form),
          stockQty: form.stockQty,
        };
        await db.products.add(product);
        products.push(product);
        if (form.stockQty !== 0) {
          await db.stockMovements.add(
            createStockMovement(
              product,
              'opening_stock',
              form.stockQty,
              `csv-import-${row.rowNumber}`,
              now,
            ),
          );
        }
        created += 1;
      }

      return { created, updated, skipped, errors };
    },
  );
}
