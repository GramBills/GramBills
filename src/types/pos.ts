export type SyncStatus = 'synced' | 'pending';
export type LanguageMode = 'en' | 'hinglish';
export type PrintSize = 'thermal_80mm' | 'thermal_58mm' | 'a4' | 'a5';
export type Unit = 'pcs' | 'meter' | 'box' | 'pair' | 'set' | 'kg';
export type GstRate = 0 | 5 | 12 | 18 | 28;

export interface BaseEntity {
  id: string;
  shopId: string;
  deviceId?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deletedAt?: string | null;
}

export interface ShopSettings extends BaseEntity {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  gstin: string;
  upiId: string;
  upiPayeeName: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultPrintSize: PrintSize;
  languageMode: LanguageMode;
  termsAndConditions: string;
}

export interface Product extends BaseEntity {
  skuCode: string;
  barcode: string;
  isCustomBarcode: boolean;
  name: string;
  nameLocal: string;
  category: string;
  brand: string;
  unit: Unit;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  minSellingPrice: number;
  gstRate: GstRate;
  taxInclusive: boolean;
  hsnCode: string;
  stockQty: number;
  lowStockThreshold: number;
  trackSerialImei: boolean;
  defaultWarrantyMonths: number;
  rackLocation: string;
}

export interface Customer extends BaseEntity {
  name: string;
  phone: string;
  villageOrArea: string;
  gstin: string;
  currentUdhaarBalance: number;
  creditLimit: number;
  totalPurchases: number;
  lastVisitDate: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  hsnCode?: string;
  costPrice?: number;
  quantity: number;
  unit: Unit;
  mrp: number;
  unitPrice: number;
  discountAmount: number;
  gstRate: GstRate;
  taxAmount: number;
  lineTotal: number;
  serialOrImeiNumbers: string[];
  warrantyMonths: number;
  warrantyExpiryDate: string | null;
}

export type InvoiceType = 'gst_tax_invoice' | 'non_gst_estimate';
export type PaymentStatus = 'paid' | 'partial_udhaar' | 'full_udhaar';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'split' | 'udhaar';
export type InvoiceStatus = 'completed' | 'cancelled' | 'returned';

export interface Invoice extends BaseEntity {
  invoiceNumber: string;
  invoiceType: InvoiceType;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerVillage: string;
  customerGstin?: string;
  items: InvoiceItem[];
  subtotal: number;
  itemDiscountTotal: number;
  extraBillDiscount: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  roundOff: number;
  grandTotal: number;
  totalCostPrice: number;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  cashPaid: number;
  upiPaid: number;
  cardPaid: number;
  udhaarAmount: number;
  upiReferenceNote: string;
  notes: string;
  status: InvoiceStatus;
  statusReason?: string;
  reversedAt?: string;
}

export type KhataTransactionType =
  | 'credit_given'
  | 'payment_received'
  | 'credit_reversed';
export type KhataPaymentMode = 'cash' | 'upi' | 'none';

export interface KhataTransaction extends BaseEntity {
  customerId: string;
  invoiceId: string | null;
  type: KhataTransactionType;
  amount: number;
  paymentMode: KhataPaymentMode;
  balanceAfter: number;
  remarks: string;
}

export type StockChangeType =
  | 'opening_stock'
  | 'purchase_in'
  | 'sale_out'
  | 'return_in'
  | 'damage_adjustment';

export interface StockMovement extends BaseEntity {
  productId: string;
  changeType: StockChangeType;
  qtyChange: number;
  referenceId: string;
}

export type OutboxEntity =
  | 'shopSettings'
  | 'products'
  | 'customers'
  | 'invoices'
  | 'khataTransactions'
  | 'stockMovements';

export interface SyncOutboxEntry {
  id: string;
  shopId: string;
  entity: OutboxEntity;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: unknown;
  status: 'pending' | 'syncing' | 'failed';
  attempts: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export type ShopSettingsForm = Pick<
  ShopSettings,
  | 'shopName'
  | 'ownerName'
  | 'phone'
  | 'address'
  | 'gstin'
  | 'upiId'
  | 'upiPayeeName'
  | 'invoicePrefix'
  | 'defaultPrintSize'
  | 'termsAndConditions'
>;

export type ProductForm = Pick<
  Product,
  | 'skuCode'
  | 'barcode'
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
  | 'stockQty'
  | 'lowStockThreshold'
  | 'trackSerialImei'
  | 'defaultWarrantyMonths'
  | 'rackLocation'
>;
