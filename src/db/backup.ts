import { APP_VERSION } from '../lib/appInfo';
import { nowIso } from '../lib/date';
import type {
  Customer,
  Invoice,
  KhataTransaction,
  Product,
  ShopSettings,
  StockMovement,
} from '../types/pos';
import { LOCAL_SHOP_ID } from './constants';
import { db } from './database';

export const BACKUP_VERSION = 1;
const LAST_BACKUP_KEY = 'grambill:last-backup-at';
const LAST_RESTORE_KEY = 'grambill:last-restore-at';

export interface BackupPayload {
  backupVersion: number;
  appVersion: string;
  exportedAt: string;
  shopId: string;
  data: {
    shopSettings: ShopSettings[];
    products: Product[];
    customers: Customer[];
    invoices: Invoice[];
    khataTransactions: KhataTransaction[];
    stockMovements: StockMovement[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): void {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label}.${key} is missing or invalid.`);
  }
}

function validateRecordArray(
  value: unknown,
  label: string,
  requiredFields: string[],
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${label}[${index}] is not a valid record.`);
    }
    for (const field of requiredFields) {
      requireString(item, field, `${label}[${index}]`);
    }
    return item;
  });
}

export function validateBackupPayload(
  value: unknown,
): asserts value is BackupPayload {
  if (!isRecord(value)) {
    throw new Error('Backup file is not a valid object.');
  }
  if (value.backupVersion !== BACKUP_VERSION) {
    throw new Error('Unsupported backup version.');
  }
  if (!isRecord(value.data)) {
    throw new Error('Backup data is missing.');
  }

  const shopSettings = validateRecordArray(
    value.data.shopSettings,
    'data.shopSettings',
    ['id', 'shopName'],
  );
  if (shopSettings.length === 0) {
    throw new Error('Backup does not contain shop settings.');
  }
  validateRecordArray(value.data.products, 'data.products', [
    'id',
    'name',
    'barcode',
    'skuCode',
  ]);
  validateRecordArray(value.data.customers, 'data.customers', [
    'id',
    'name',
    'phone',
  ]);
  validateRecordArray(value.data.invoices, 'data.invoices', [
    'id',
    'invoiceNumber',
  ]);
  validateRecordArray(
    value.data.khataTransactions,
    'data.khataTransactions',
    ['id', 'customerId'],
  );
  validateRecordArray(value.data.stockMovements, 'data.stockMovements', [
    'id',
    'productId',
  ]);
}

export async function createBackup(): Promise<BackupPayload> {
  const [
    shopSettings,
    products,
    customers,
    invoices,
    khataTransactions,
    stockMovements,
  ] = await Promise.all([
    db.shopSettings.toArray(),
    db.products.toArray(),
    db.customers.toArray(),
    db.invoices.toArray(),
    db.khataTransactions.toArray(),
    db.stockMovements.toArray(),
  ]);

  return {
    backupVersion: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    shopId: shopSettings[0]?.shopId ?? LOCAL_SHOP_ID,
    data: {
      shopSettings,
      products,
      customers,
      invoices,
      khataTransactions,
      stockMovements,
    },
  };
}

export async function downloadBackup(): Promise<BackupPayload> {
  const payload = await createBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = payload.exportedAt.replace(/[:.]/g, '-').slice(0, 19);
  anchor.href = url;
  anchor.download = `grambill-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_BACKUP_KEY, payload.exportedAt);
  return payload;
}

export async function restoreBackupFromFile(file: File): Promise<BackupPayload> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  validateBackupPayload(parsed);

  await db.transaction(
    'rw',
    [
      db.shopSettings,
      db.products,
      db.customers,
      db.invoices,
      db.khataTransactions,
      db.stockMovements,
    ],
    async () => {
      await Promise.all([
        db.shopSettings.clear(),
        db.products.clear(),
        db.customers.clear(),
        db.invoices.clear(),
        db.khataTransactions.clear(),
        db.stockMovements.clear(),
      ]);
      await db.shopSettings.bulkPut(parsed.data.shopSettings);
      await db.products.bulkPut(parsed.data.products);
      await db.customers.bulkPut(parsed.data.customers);
      await db.invoices.bulkPut(parsed.data.invoices);
      await db.khataTransactions.bulkPut(parsed.data.khataTransactions);
      await db.stockMovements.bulkPut(parsed.data.stockMovements);
    },
  );

  localStorage.setItem(LAST_RESTORE_KEY, nowIso());
  return parsed;
}

export function getLastBackupAt(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

export function getLastRestoreAt(): string | null {
  return localStorage.getItem(LAST_RESTORE_KEY);
}
