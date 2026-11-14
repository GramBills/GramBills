import { describe, expect, it } from 'vitest';
import type {
  Invoice,
  InvoiceItem,
  KhataTransaction,
  Product,
} from '../types/pos';
import {
  buildReportSummary,
  getCustomReportRange,
  getReportRange,
  type DateRange,
} from './reports';

const base = {
  shopId: 'shop',
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T10:00:00.000Z',
  syncStatus: 'synced' as const,
};

function item(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: 'item-1',
    productId: 'p1',
    productName: 'LED Bulb',
    barcode: '111',
    quantity: 2,
    unit: 'pcs',
    mrp: 120,
    unitPrice: 100,
    discountAmount: 0,
    gstRate: 12,
    taxAmount: 21.43,
    lineTotal: 200,
    serialOrImeiNumbers: [],
    warrantyMonths: 12,
    warrantyExpiryDate: null,
    costPrice: 60,
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    ...base,
    id: 'inv-1',
    invoiceNumber: 'INV-1',
    invoiceType: 'gst_tax_invoice',
    customerId: null,
    customerName: 'Walk-in',
    customerPhone: '',
    customerVillage: '',
    items: [item()],
    subtotal: 200,
    itemDiscountTotal: 0,
    extraBillDiscount: 0,
    taxableAmount: 178.57,
    cgstTotal: 10.71,
    sgstTotal: 10.72,
    roundOff: 0,
    grandTotal: 200,
    totalCostPrice: 120,
    paymentStatus: 'paid',
    paymentMode: 'cash',
    cashPaid: 200,
    upiPaid: 0,
    cardPaid: 0,
    udhaarAmount: 0,
    upiReferenceNote: '',
    notes: '',
    status: 'completed',
    ...overrides,
  };
}

function khata(overrides: Partial<KhataTransaction> = {}): KhataTransaction {
  return {
    ...base,
    id: 'k1',
    customerId: 'c1',
    invoiceId: null,
    type: 'payment_received',
    amount: 300,
    paymentMode: 'upi',
    balanceAfter: 500,
    remarks: '',
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    ...base,
    id: 'p1',
    skuCode: 'SKU1',
    barcode: '111',
    isCustomBarcode: false,
    name: 'LED Bulb',
    nameLocal: '',
    category: 'Lighting',
    brand: 'Havells',
    unit: 'pcs',
    purchasePrice: 60,
    mrp: 120,
    sellingPrice: 100,
    minSellingPrice: 90,
    gstRate: 12,
    taxInclusive: true,
    hsnCode: '8539',
    stockQty: 2,
    lowStockThreshold: 5,
    trackSerialImei: false,
    defaultWarrantyMonths: 12,
    rackLocation: '',
    ...overrides,
  };
}

const range: DateRange = {
  start: new Date('2026-06-15T00:00:00.000Z'),
  end: new Date('2026-06-15T23:59:59.999Z'),
  label: 'Today',
};

describe('report helpers', () => {
  it('builds report totals, collections, profit and top products', () => {
    const summary = buildReportSummary(
      [
        invoice(),
        invoice({
          id: 'inv-2',
          invoiceNumber: 'INV-2',
          paymentMode: 'split',
          cashPaid: 50,
          upiPaid: 50,
          udhaarAmount: 100,
          paymentStatus: 'partial_udhaar',
          items: [
            item({
              id: 'item-2',
              productId: 'p2',
              productName: 'Fan',
              quantity: 1,
              lineTotal: 300,
              taxAmount: 45,
              costPrice: 200,
            }),
          ],
          grandTotal: 300,
          taxableAmount: 255,
          cgstTotal: 22.5,
          sgstTotal: 22.5,
          totalCostPrice: 200,
        }),
        invoice({
          id: 'inv-3',
          status: 'cancelled',
          grandTotal: 999,
        }),
      ],
      [khata()],
      [
        product(),
        product({
          id: 'p2',
          name: 'Fan',
          stockQty: 0,
          lowStockThreshold: 2,
        }),
      ],
      range,
    );

    expect(summary.invoiceCount).toBe(2);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.salesTotal).toBe(500);
    expect(summary.cashCollected).toBe(250);
    expect(summary.upiCollected).toBe(350);
    expect(summary.newUdhaar).toBe(100);
    expect(summary.udhaarCollected).toBe(300);
    expect(summary.netProfit).toBe(113.57);
    expect(summary.topProducts[0]?.productName).toBe('Fan');
    expect(summary.lowStock).toHaveLength(2);
    expect(summary.lowStock[0]?.name).toBe('Fan');
  });

  it('creates preset ranges and validates custom ranges', () => {
    const now = new Date(2026, 5, 15, 12);
    expect(getReportRange('today', now).label).toBe('Today');
    expect(getReportRange('week', now).start.getDate()).toBe(9);
    expect(getReportRange('month', now).start.getDate()).toBe(1);
    expect(
      getCustomReportRange('2026-06-01', '2026-06-15').label,
    ).toContain('01 Jun 2026');
    expect(() => getCustomReportRange('2026-06-20', '2026-06-01')).toThrow(
      'before the start',
    );
  });
});
