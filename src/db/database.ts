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
import { nowIso } from '../lib/date';
import { newId } from '../lib/id';
import { DB_NAME, LOCAL_DEVICE_ID, LOCAL_SHOP_ID } from './constants';
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
    const schema = {
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
    };

    this.version(1).stores(schema);
    this.version(2)
      .stores(schema)
      .upgrade(async (transaction) => {
        const customers = (await transaction
          .table('customers')
          .toArray()) as Customer[];
        const khataTable = transaction.table(
          'khataTransactions',
        ) as Table<KhataTransaction, string>;

        for (const customer of customers) {
          if (customer.currentUdhaarBalance <= 0) {
            continue;
          }
          const existing = await khataTable
            .where('customerId')
            .equals(customer.id)
            .count();
          if (existing > 0) {
            continue;
          }
          const now = nowIso();
          await khataTable.add({
            id: newId(),
            shopId: LOCAL_SHOP_ID,
            deviceId: LOCAL_DEVICE_ID,
            createdAt: now,
            updatedAt: now,
            syncStatus: 'synced',
            customerId: customer.id,
            invoiceId: null,
            type: 'credit_given',
            amount: customer.currentUdhaarBalance,
            paymentMode: 'none',
            balanceAfter: customer.currentUdhaarBalance,
            remarks: 'Opening balance',
          });
        }
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
