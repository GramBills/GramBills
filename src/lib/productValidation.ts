import type { GstRate, Product, ProductForm, Unit } from '../types/pos';
import { normalizeBarcode } from './id';
import { round2 } from './money';

export type ProductFormErrors = Partial<Record<keyof ProductForm, string>>;

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'pcs', label: 'Pieces' },
  { value: 'meter', label: 'Meter' },
  { value: 'box', label: 'Box' },
  { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' },
  { value: 'kg', label: 'Kilogram' },
];

export const GST_RATE_OPTIONS: GstRate[] = [0, 5, 12, 18, 28];

const UNIT_VALUES = UNIT_OPTIONS.map((option) => option.value);
const BARCODE_REGEX = /^[A-Za-z0-9._-]+$/;

export function emptyProductForm(): ProductForm {
  return {
    skuCode: '',
    barcode: '',
    name: '',
    nameLocal: '',
    category: '',
    brand: '',
    unit: 'pcs',
    purchasePrice: 0,
    mrp: 0,
    sellingPrice: 0,
    minSellingPrice: 0,
    gstRate: 18,
    taxInclusive: true,
    hsnCode: '',
    stockQty: 0,
    lowStockThreshold: 5,
    trackSerialImei: false,
    defaultWarrantyMonths: 0,
    rackLocation: '',
  };
}

export function productToForm(product: Product): ProductForm {
  return {
    skuCode: product.skuCode,
    barcode: product.barcode,
    name: product.name,
    nameLocal: product.nameLocal,
    category: product.category,
    brand: product.brand,
    unit: product.unit,
    purchasePrice: product.purchasePrice,
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    minSellingPrice: product.minSellingPrice,
    gstRate: product.gstRate,
    taxInclusive: product.taxInclusive,
    hsnCode: product.hsnCode,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    trackSerialImei: product.trackSerialImei,
    defaultWarrantyMonths: product.defaultWarrantyMonths,
    rackLocation: product.rackLocation,
  };
}

export function normalizeProductForm(form: ProductForm): ProductForm {
  return {
    ...form,
    skuCode: form.skuCode.trim().toUpperCase(),
    barcode: normalizeBarcode(form.barcode),
    name: form.name.trim(),
    nameLocal: form.nameLocal.trim(),
    category: form.category.trim(),
    brand: form.brand.trim(),
    hsnCode: form.hsnCode.trim(),
    rackLocation: form.rackLocation.trim(),
    purchasePrice: round2(form.purchasePrice),
    mrp: round2(form.mrp),
    sellingPrice: round2(form.sellingPrice),
    minSellingPrice: round2(form.minSellingPrice),
    stockQty: round2(form.stockQty),
    lowStockThreshold: round2(form.lowStockThreshold),
    defaultWarrantyMonths: Math.trunc(form.defaultWarrantyMonths),
  };
}

export function validateProductForm(form: ProductForm): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (form.name.trim().length < 2) {
    errors.name = 'Enter the product name.';
  }
  if (form.category.trim().length < 2) {
    errors.category = 'Enter a category.';
  }
  if (!UNIT_VALUES.includes(form.unit)) {
    errors.unit = 'Choose a valid unit.';
  }
  if (!GST_RATE_OPTIONS.includes(form.gstRate)) {
    errors.gstRate = 'Choose a valid GST rate.';
  }

  if (!Number.isFinite(form.purchasePrice) || form.purchasePrice < 0) {
    errors.purchasePrice = 'Purchase price cannot be negative.';
  }
  if (!Number.isFinite(form.mrp) || form.mrp <= 0) {
    errors.mrp = 'MRP must be greater than zero.';
  }
  if (!Number.isFinite(form.sellingPrice) || form.sellingPrice <= 0) {
    errors.sellingPrice = 'Selling price must be greater than zero.';
  }
  if (!Number.isFinite(form.minSellingPrice) || form.minSellingPrice < 0) {
    errors.minSellingPrice = 'Floor price cannot be negative.';
  }
  if (
    Number.isFinite(form.mrp) &&
    Number.isFinite(form.sellingPrice) &&
    form.sellingPrice > form.mrp
  ) {
    errors.sellingPrice = 'Selling price cannot be higher than MRP.';
  }
  if (
    Number.isFinite(form.minSellingPrice) &&
    Number.isFinite(form.sellingPrice) &&
    form.minSellingPrice > form.sellingPrice
  ) {
    errors.minSellingPrice = 'Floor price cannot be above selling price.';
  }

  if (!Number.isFinite(form.stockQty) || form.stockQty < 0) {
    errors.stockQty = 'Stock cannot be negative.';
  }
  if (
    !Number.isFinite(form.lowStockThreshold) ||
    form.lowStockThreshold < 0
  ) {
    errors.lowStockThreshold = 'Low-stock alert cannot be negative.';
  }
  if (
    !Number.isFinite(form.defaultWarrantyMonths) ||
    form.defaultWarrantyMonths < 0 ||
    !Number.isInteger(form.defaultWarrantyMonths)
  ) {
    errors.defaultWarrantyMonths =
      'Warranty must be a whole number of months.';
  }

  const barcode = normalizeBarcode(form.barcode);
  if (barcode !== '' && (barcode.length > 64 || !BARCODE_REGEX.test(barcode))) {
    errors.barcode = 'Use letters, numbers, dots, hyphens or underscores.';
  }

  return errors;
}

export function firstProductError(errors: ProductFormErrors): string {
  const first = Object.values(errors).find(Boolean);
  return first ?? 'Please fix the highlighted product fields.';
}

export function isProductLowStock(product: Product): boolean {
  return product.stockQty > 0 && product.stockQty <= product.lowStockThreshold;
}

export function isProductOutOfStock(product: Product): boolean {
  return product.stockQty <= 0;
}

export function isProductUnbarcoded(product: Product): boolean {
  return product.barcode.trim() === '';
}
