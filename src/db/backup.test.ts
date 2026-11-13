import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_SHOP_ID } from './constants';
import {
  BACKUP_VERSION,
  createBackup,
  downloadBackup,
  getLastBackupAt,
  getLastRestoreAt,
  restoreBackupFromFile,
  validateBackupPayload,
  type BackupPayload,
} from './backup';
import { db } from './database';
import { seedInitialData } from './seed';

function makeBackupFile(text: string): File {
  const file = new File([text], 'backup.json', {
    type: 'application/json',
  });
  if (typeof file.text !== 'function') {
    Object.defineProperty(file, 'text', {
      value: async () => text,
    });
  }
  return file;
}

function minimalPayload(): BackupPayload {
  return {
    backupVersion: BACKUP_VERSION,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    shopId: LOCAL_SHOP_ID,
    data: {
      shopSettings: [],
      products: [],
      customers: [],
      invoices: [],
      khataTransactions: [],
      stockMovements: [],
    },
  };
}

beforeEach(async () => {
  localStorage.clear();
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
  db.close();
});

describe('backup', () => {
  it('creates a backup with seeded data', async () => {
    await seedInitialData(db);

    const payload = await createBackup();

    expect(payload.backupVersion).toBe(BACKUP_VERSION);
    expect(payload.shopId).toBe(LOCAL_SHOP_ID);
    expect(payload.data.shopSettings).toHaveLength(1);
    expect(payload.data.products).toHaveLength(15);
    expect(payload.data.customers).toHaveLength(4);
    expect(payload.data.stockMovements).toHaveLength(15);
    expect(payload.data.invoices).toEqual([]);
    expect(() => validateBackupPayload(payload)).not.toThrow();
  });

  it('validates the backup envelope and required fields', () => {
    expect(() => validateBackupPayload(null)).toThrow();
    expect(() => validateBackupPayload({})).toThrow();
    expect(() =>
      validateBackupPayload({ ...minimalPayload(), backupVersion: 99 }),
    ).toThrow('Unsupported backup version');
    expect(() =>
      validateBackupPayload({
        ...minimalPayload(),
        data: {
          ...minimalPayload().data,
          shopSettings: [{ id: 'shop-1', shopName: 'Test Shop' }],
          products: 'nope',
        },
      }),
    ).toThrow('must be an array');
    expect(() =>
      validateBackupPayload({
        ...minimalPayload(),
        data: {
          ...minimalPayload().data,
          shopSettings: [{ id: 'shop-1', shopName: 'Test Shop' }],
          products: [{ id: 'p-1', name: 'Bulb' }],
        },
      }),
    ).toThrow('barcode');
  });

  it('requires at least one shop settings record', () => {
    expect(() => validateBackupPayload(minimalPayload())).toThrow(
      'shop settings',
    );
  });

  it('restores a valid backup file', async () => {
    await seedInitialData(db);
    const payload = await createBackup();

    await Promise.all([
      db.shopSettings.clear(),
      db.products.clear(),
      db.customers.clear(),
      db.invoices.clear(),
      db.khataTransactions.clear(),
      db.stockMovements.clear(),
    ]);

    const restored = await restoreBackupFromFile(
      makeBackupFile(JSON.stringify(payload)),
    );

    expect(restored.data.products).toHaveLength(15);
    expect(await db.shopSettings.count()).toBe(1);
    expect(await db.products.count()).toBe(15);
    expect(await db.customers.count()).toBe(4);
    expect(getLastRestoreAt()).not.toBeNull();
  });

  it('rejects invalid JSON and records successful downloads', async () => {
    await expect(
      restoreBackupFromFile(makeBackupFile('{not-json')),
    ).rejects.toThrow('not valid JSON');

    await seedInitialData(db);
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => 'blob:backup');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });

    const payload = await downloadBackup();

    expect(getLastBackupAt()).toBe(payload.exportedAt);
    expect(anchorClick).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');

    anchorClick.mockRestore();
  });
});
