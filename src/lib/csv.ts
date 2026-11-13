import type { GstRate, Product, ProductForm, Unit } from '../types/pos';
import { emptyProductForm } from './productValidation';

export const PRODUCT_CSV_HEADERS = [
  'sku_code',
  'name',
  'name_local',
  'category',
  'brand',
  'unit',
  'purchase_price',
  'mrp',
  'selling_price',
  'min_selling_price',
  'gst_rate',
  'tax_inclusive',
  'hsn_code',
  'stock_qty',
  'low_stock_threshold',
  'track_serial_imei',
  'default_warranty_months',
  'rack_location',
  'barcode',
] as const;

const REQUIRED_HEADERS = [
  'name',
  'category',
  'unit',
  'purchase_price',
  'mrp',
  'selling_price',
  'min_selling_price',
  'gst_rate',
] as const;

export interface ParsedProductCsvRow {
  rowNumber: number;
  form: ProductForm;
}

export interface ProductCsvParseResult {
  rows: ParsedProductCsvRow[];
  errors: string[];
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return `${rows
    .map((row) =>
      row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','),
    )
    .join('\r\n')}\r\n`;
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else if (char === '\r') {
        continue;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error('CSV has an unclosed quoted field.');
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((current) =>
    current.some((cell) => cell.trim() !== ''),
  );
}

function booleanText(value: boolean): string {
  return value ? 'yes' : 'no';
}

function parseBoolean(value: string, fallback: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalized)) {
    return true;
  }
  if (['no', 'false', '0', 'n'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseNumber(value: string): number {
  const normalized = value.trim().replace(/,/g, '');
  if (normalized === '') {
    return 0;
  }
  return Number(normalized);
}

export function productToCsvRow(product: Product): (string | number)[] {
  return [
    product.skuCode,
    product.name,
    product.nameLocal,
    product.category,
    product.brand,
    product.unit,
    product.purchasePrice,
    product.mrp,
    product.sellingPrice,
    product.minSellingPrice,
    product.gstRate,
    booleanText(product.taxInclusive),
    product.hsnCode,
    product.stockQty,
    product.lowStockThreshold,
    booleanText(product.trackSerialImei),
    product.defaultWarrantyMonths,
    product.rackLocation,
    product.barcode,
  ];
}

export function productsToCsv(products: Product[]): string {
  return toCsv([
    [...PRODUCT_CSV_HEADERS],
    ...products.map(productToCsvRow),
  ]);
}

export function productCsvTemplate(): string {
  const sample: ProductForm = {
    ...emptyProductForm(),
    skuCode: 'ELEC-2001',
    name: 'Sample LED Bulb 9W',
    nameLocal: 'सैंपल एलईडी बल्ब 9W',
    category: 'Lighting',
    brand: 'Havells',
    purchasePrice: 62,
    mrp: 120,
    sellingPrice: 110,
    minSellingPrice: 95,
    hsnCode: '8539',
    stockQty: 20,
    lowStockThreshold: 5,
    defaultWarrantyMonths: 12,
    rackLocation: 'Rack A - Shelf 1',
    barcode: 'SKU0002001',
  };
  return toCsv([
    [...PRODUCT_CSV_HEADERS],
    [
      sample.skuCode,
      sample.name,
      sample.nameLocal,
      sample.category,
      sample.brand,
      sample.unit,
      sample.purchasePrice,
      sample.mrp,
      sample.sellingPrice,
      sample.minSellingPrice,
      sample.gstRate,
      booleanText(sample.taxInclusive),
      sample.hsnCode,
      sample.stockQty,
      sample.lowStockThreshold,
      booleanText(sample.trackSerialImei),
      sample.defaultWarrantyMonths,
      sample.rackLocation,
      sample.barcode,
    ],
  ]);
}

export function parseProductCsv(text: string): ProductCsvParseResult {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: ['CSV file is empty.'] };
  }

  const headers = table[0].map((header) => header.trim().toLowerCase());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const missing = REQUIRED_HEADERS.filter(
    (header) => !headerIndex.has(header),
  );
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [`Missing required CSV columns: ${missing.join(', ')}.`],
    };
  }

  const rows: ParsedProductCsvRow[] = [];
  const errors: string[] = [];

  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index];
    const get = (header: string): string => {
      const cellIndex = headerIndex.get(header);
      return cellIndex === undefined ? '' : (cells[cellIndex] ?? '');
    };

    const form: ProductForm = {
      ...emptyProductForm(),
      skuCode: get('sku_code').trim(),
      barcode: get('barcode').trim(),
      name: get('name'),
      nameLocal: get('name_local'),
      category: get('category'),
      brand: get('brand'),
      unit: (get('unit').trim().toLowerCase() || 'pcs') as Unit,
      purchasePrice: parseNumber(get('purchase_price')),
      mrp: parseNumber(get('mrp')),
      sellingPrice: parseNumber(get('selling_price')),
      minSellingPrice: parseNumber(get('min_selling_price')),
      gstRate: parseNumber(get('gst_rate')) as GstRate,
      taxInclusive: parseBoolean(get('tax_inclusive'), true),
      hsnCode: get('hsn_code').trim(),
      stockQty: parseNumber(get('stock_qty')),
      lowStockThreshold: parseNumber(get('low_stock_threshold')),
      trackSerialImei: parseBoolean(get('track_serial_imei'), false),
      defaultWarrantyMonths: parseNumber(get('default_warranty_months')),
      rackLocation: get('rack_location').trim(),
    };

    rows.push({ rowNumber: index + 1, form });
  }

  return { rows, errors };
}
