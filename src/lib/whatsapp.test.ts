import { describe, expect, it } from 'vitest';
import type { Invoice, ShopSettings } from '../types/pos';
import {
  buildReceiptMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
} from './whatsapp';

const settings: ShopSettings = {
  id: 'local-shop-01',
  shopId: 'local-shop-01',
  deviceId: 'local-device-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncStatus: 'synced',
  shopName: 'Shree Electronics & Electricals',
  ownerName: 'Rakesh Kumar',
  phone: '9876500000',
  address: 'Main Market, Nandpur',
  gstin: '',
  upiId: 'shopowner@upi',
  upiPayeeName: 'Shree Electronics',
  invoicePrefix: 'INV-2026-',
  nextInvoiceNumber: 2,
  defaultPrintSize: 'a4',
  languageMode: 'en',
  termsAndConditions: '',
};

const invoice: Invoice = {
  id: 'invoice-1',
  shopId: 'local-shop-01',
  deviceId: 'local-device-01',
  createdAt: '2026-11-13T10:00:00.000Z',
  updatedAt: '2026-11-13T10:00:00.000Z',
  syncStatus: 'pending',
  invoiceNumber: 'INV-2026-0001',
  invoiceType: 'gst_tax_invoice',
  customerId: 'customer-1',
  customerName: 'Ramesh Patel',
  customerPhone: '9876543210',
  customerVillage: 'Nandpur',
  items: [
    {
      id: 'item-1',
      productId: 'product-1',
      productName: 'Havells 9W LED Bulb',
      barcode: '8902670100011',
      quantity: 2,
      unit: 'pcs',
      mrp: 120,
      unitPrice: 110,
      discountAmount: 0,
      gstRate: 12,
      taxAmount: 23.57,
      lineTotal: 220,
      serialOrImeiNumbers: ['SN-001', 'SN-002'],
      warrantyMonths: 12,
      warrantyExpiryDate: '2027-11-13T10:00:00.000Z',
    },
  ],
  subtotal: 220,
  itemDiscountTotal: 0,
  extraBillDiscount: 0,
  taxableAmount: 196.43,
  cgstTotal: 11.79,
  sgstTotal: 11.78,
  roundOff: 0,
  grandTotal: 220,
  totalCostPrice: 124,
  paymentStatus: 'partial_udhaar',
  paymentMode: 'split',
  cashPaid: 120,
  upiPaid: 0,
  cardPaid: 0,
  udhaarAmount: 100,
  upiReferenceNote: '',
  notes: 'Delivered in evening',
  status: 'completed',
};

describe('WhatsApp receipt', () => {
  it('builds a receipt message with items, warranty, payment, and balance', () => {
    const message = buildReceiptMessage(invoice, settings, {
      customerBalance: 1350,
    });

    expect(message).toContain('*Shree Electronics & Electricals*');
    expect(message).toContain('Bill: INV-2026-0001');
    expect(message).toContain('Customer: Ramesh Patel');
    expect(message).toContain('Havells 9W LED Bulb x 2');
    expect(message).toContain('Warranty till');
    expect(message).toContain('SN-001, SN-002');
    expect(message).toContain('Cash ₹120.00 + Udhaar ₹100.00');
    expect(message).toContain('Udhaar balance: ₹1,350.00');
    expect(message).toContain('Delivered in evening');
  });

  it('normalizes 10-digit and country-code phone numbers', () => {
    expect(normalizeWhatsAppPhone('98765 43210')).toBe('919876543210');
    expect(normalizeWhatsAppPhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizeWhatsAppPhone('')).toBe('');
  });

  it('builds a wa.me URL with encoded message text', () => {
    const url = buildWhatsAppUrl('9876543210', 'Hello & welcome');
    expect(url).toBe(
      'https://wa.me/919876543210?text=Hello%20%26%20welcome',
    );
    expect(buildWhatsAppUrl('', 'Hello')).toBe('');
  });
});
