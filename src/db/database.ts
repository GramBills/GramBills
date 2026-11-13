import Dexie, { type Table } from 'dexie';
import type {
  Customer,
  Invoice,
  KhataTransaction,
  Product,
  ShopSettings,
  StockMovement,
  SyncOutboxEntry,
} from '../types/pos';
import { DB_NAME } from './constants';
import { seedInitialData } from './seed';

export class GramBillDB extends Dexie {
  shopSettings!: Table<ShopSettings, string>;
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  invoices!: Table<Invoice, string>;
  khataTransactions!: Table<KhataTransaction, string>;
  stockMovements!: Table<StockMovement, string>;
  syncOutbox!: Table<SyncOutboxEntry, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      shopSettings: '&id, shopId, updatedAt, syncStatus',
      products:
        '&id, shopId, &skuCode, barcode, name, nameLocal, category, brand, stockQty, updatedAt, syncStatus',
      customers:
        '&id, shopId, &phone, name, villageOrArea, updatedAt, syncStatus',
      invoices:
        '&id, shopId, &invoiceNumber, customerId, customerPhone, createdAt, status, syncStatus',
      khataTransactions:
        '&id, shopId, customerId, invoiceId, type, createdAt, syncStatus',
      stockMovements:
        '&id, shopId, productId, changeType, referenceId, createdAt, syncStatus',
      syncOutbox: '&id, shopId, status, entity, createdAt',
    });
  }
}

export const db = new GramBillDB();

async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return;
  }
  try {
    const persisted = await navigator.storage.persisted();
    if (!persisted) {
      await navigator.storage.persist();
    }
  } catch {
    return;
  }
}

export async function initializeDatabase(): Promise<void> {
  await db.open();
  await seedInitialData(db);
  void requestPersistentStorage();
}
