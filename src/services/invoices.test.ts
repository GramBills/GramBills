import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_SHOP_ID } from '../db/constants';
import { db } from '../db/database';
import { seedInitialData } from '../db/seed';
import { calculateInvoice } from '../lib/gst';
import type { Customer, Product } from '../types/pos';
import {
  createInvoice,
  invoiceMatchesSearch,
  reverseInvoice,
  searchInvoices,
  type CheckoutLineInput,
} from './invoices';

async function productBySku(skuCode: string): Promise<Product> {
  const product = await db.products.where('skuCode').equals(skuCode).first();
  if (!product) {
    throw new Error(`Missing product ${skuCode}`);
  }
  return product;
}

async function customerByPhone(phone: string): Promise<Customer> {
  const customer = await db.customers.where('phone').equals(phone).first();
  if (!customer) {
    throw new Error(`Missing customer ${phone}`);
  }
  return customer;
}

function line(
  product: Product,
  overrides: Partial<CheckoutLineInput> = {},
): CheckoutLineInput {
  return {
    productId: product.id,
    quantity: 1,
    unitPrice: product.sellingPrice,
    discountAmount: 0,
    serialOrImeiNumbers: [],
    warrantyMonths: product.defaultWarrantyMonths,
    ...overrides,
  };
}

function grandTotal(product: Product, items: CheckoutLineInput[]): number {
  return calculateInvoice(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      gstRate: product.gstRate,
      taxInclusive: product.taxInclusive,
    })),
  ).totals.grandTotal;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedInitialData(db);
});

afterAll(async () => {
  await db.delete();
  db.close();
});

describe('invoice checkout', () => {
  it('creates a cash invoice and deducts stock atomically', async () => {
    const product = await productBySku('ELEC-1001');
    const items = [line(product, { quantity: 2 })];
    const total = grandTotal(product, items);

    const result = await createInvoice({
      invoiceType: 'gst_tax_invoice',
      customer: null,
      items,
      extraBillDiscount: 0,
      payment: {
        mode: 'cash',
        cashPaid: total,
        upiPaid: 0,
        cardPaid: 0,
        udhaarAmount: 0,
        upiReferenceNote: '',
        notes: '',
      },
    });

    expect(result.invoice.invoiceNumber).toBe('INV-2026-0001');
    expect(result.invoice.grandTotal).toBe(total);
    expect(result.invoice.paymentStatus).toBe('paid');
    expect(result.invoice.paymentMode).toBe('cash');

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct?.stockQty).toBe(product.stockQty - 2);

    const movement = await db.stockMovements
      .where('referenceId')
      .equals(result.invoice.id)
      .first();
    expect(movement?.changeType).toBe('sale_out');
    expect(movement?.qtyChange).toBe(-2);

    const settings = await db.shopSettings.get(LOCAL_SHOP_ID);
    expect(settings?.nextInvoiceNumber).toBe(2);
  });

  it('records udhaar against the customer khata', async () => {
    const product = await productBySku('ELEC-1002');
    const customer = await customerByPhone('9876543210');
    const items = [line(product)];
    const total = grandTotal(product, items);

    const result = await createInvoice({
      invoiceType: 'non_gst_estimate',
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        villageOrArea: customer.villageOrArea,
      },
      items,
      extraBillDiscount: 0,
      payment: {
        mode: 'udhaar',
        cashPaid: 0,
        upiPaid: 0,
        cardPaid: 0,
        udhaarAmount: total,
        upiReferenceNote: '',
        notes: '',
      },
    });

    expect(result.invoice.paymentStatus).toBe('full_udhaar');
    expect(result.invoice.paymentMode).toBe('udhaar');

    const updatedCustomer = await db.customers.get(customer.id);
    expect(updatedCustomer?.currentUdhaarBalance).toBe(
      customer.currentUdhaarBalance + total,
    );
    expect(updatedCustomer?.totalPurchases).toBe(
      customer.totalPurchases + total,
    );

    const khata = await db.khataTransactions
      .where('invoiceId')
      .equals(result.invoice.id)
      .first();
    expect(khata?.type).toBe('credit_given');
    expect(khata?.amount).toBe(total);
    expect(khata?.balanceAfter).toBe(updatedCustomer?.currentUdhaarBalance);
  });

  it('supports split payment with udhaar', async () => {
    const product = await productBySku('ELEC-1001');
    const customer = await customerByPhone('9876543211');
    const items = [line(product)];
    const total = grandTotal(product, items);

    const result = await createInvoice({
      invoiceType: 'non_gst_estimate',
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        villageOrArea: customer.villageOrArea,
      },
      items,
      extraBillDiscount: 0,
      payment: {
        mode: 'split',
        cashPaid: 50,
        upiPaid: 50,
        cardPaid: 0,
        udhaarAmount: total - 100,
        upiReferenceNote: 'UPI-123',
        notes: 'Delivered in evening',
      },
    });

    expect(result.invoice.paymentMode).toBe('split');
    expect(result.invoice.paymentStatus).toBe('partial_udhaar');
    expect(result.invoice.cashPaid).toBe(50);
    expect(result.invoice.upiPaid).toBe(50);
    expect(result.invoice.udhaarAmount).toBe(total - 100);
  });

  it('rejects payment totals that do not match the bill', async () => {
    const product = await productBySku('ELEC-1001');
    const items = [line(product)];

    await expect(
      createInvoice({
        invoiceType: 'non_gst_estimate',
        customer: null,
        items,
        extraBillDiscount: 0,
        payment: {
          mode: 'cash',
          cashPaid: 1,
          upiPaid: 0,
          cardPaid: 0,
          udhaarAmount: 0,
          upiReferenceNote: '',
          notes: '',
        },
      }),
    ).rejects.toThrow('Payment total must equal');
  });

  it('rejects below-floor prices unless override is confirmed', async () => {
    const product = await productBySku('ELEC-1001');
    const items = [line(product, { unitPrice: product.minSellingPrice - 1 })];
    const total = grandTotal(product, items);

    await expect(
      createInvoice({
        invoiceType: 'non_gst_estimate',
        customer: null,
        items,
        extraBillDiscount: 0,
        payment: {
          mode: 'cash',
          cashPaid: total,
          upiPaid: 0,
          cardPaid: 0,
          udhaarAmount: 0,
          upiReferenceNote: '',
          notes: '',
        },
      }),
    ).rejects.toThrow('below the floor price');
  });

  it('requires serial numbers for tracked products', async () => {
    const product = await productBySku('ELEC-1006');
    const items = [line(product)];
    const total = grandTotal(product, items);

    await expect(
      createInvoice({
        invoiceType: 'non_gst_estimate',
        customer: null,
        items,
        extraBillDiscount: 0,
        payment: {
          mode: 'cash',
          cashPaid: total,
          upiPaid: 0,
          cardPaid: 0,
          udhaarAmount: 0,
          upiReferenceNote: '',
          notes: '',
        },
      }),
    ).rejects.toThrow('serial/IMEI');
  });

  it('deducts stock correctly when a product appears on multiple lines', async () => {
    const product = await productBySku('ELEC-1001');
    const items = [
      line(product, { quantity: 1 }),
      line(product, { quantity: 2 }),
    ];
    const total = grandTotal(product, items);

    await createInvoice({
      invoiceType: 'non_gst_estimate',
      customer: null,
      items,
      extraBillDiscount: 0,
      payment: {
        mode: 'cash',
        cashPaid: total,
        upiPaid: 0,
        cardPaid: 0,
        udhaarAmount: 0,
        upiReferenceNote: '',
        notes: '',
      },
    });

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct?.stockQty).toBe(product.stockQty - 3);
  });

  it('cancels an invoice, restores stock and reverses udhaar once', async () => {
    const product = await productBySku('ELEC-1002');
    const customer = await customerByPhone('9876543210');
    const items = [line(product, { quantity: 2 })];
    const total = grandTotal(product, items);

    const result = await createInvoice({
      invoiceType: 'gst_tax_invoice',
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        villageOrArea: customer.villageOrArea,
      },
      items,
      extraBillDiscount: 0,
      payment: {
        mode: 'udhaar',
        cashPaid: 0,
        upiPaid: 0,
        cardPaid: 0,
        udhaarAmount: total,
        upiReferenceNote: '',
        notes: '',
      },
    });

    const afterSale = await db.customers.get(customer.id);
    expect(afterSale?.currentUdhaarBalance).toBe(
      customer.currentUdhaarBalance + total,
    );

    const reversed = await reverseInvoice({
      invoiceId: result.invoice.id,
      mode: 'cancelled',
      reason: 'Customer changed mind',
    });

    expect(reversed.invoice.status).toBe('cancelled');
    expect(reversed.invoice.statusReason).toBe('Customer changed mind');
    expect(reversed.customer?.currentUdhaarBalance).toBe(
      customer.currentUdhaarBalance,
    );

    const storedProduct = await db.products.get(product.id);
    expect(storedProduct?.stockQty).toBe(product.stockQty);

    const returnMovement = await db.stockMovements
      .where('referenceId')
      .equals(result.invoice.id)
      .filter((movement) => movement.changeType === 'return_in')
      .first();
    expect(returnMovement?.qtyChange).toBe(2);

    const reversalEntries = await db.khataTransactions
      .where('invoiceId')
      .equals(result.invoice.id)
      .filter((transaction) => transaction.type === 'credit_reversed')
      .toArray();
    expect(reversalEntries).toHaveLength(1);
    expect(reversalEntries[0]?.amount).toBe(total);

    await expect(
      reverseInvoice({ invoiceId: result.invoice.id, mode: 'returned' }),
    ).rejects.toThrow('already been cancelled or returned');
  });

  it('searches invoices by number, phone and serial/IMEI', async () => {
    const product = await productBySku('ELEC-1006');
    const customer = await customerByPhone('9876543211');
    const items = [
      line(product, { serialOrImeiNumbers: ['IMEI-99887766'] }),
    ];
    const total = grandTotal(product, items);

    const result = await createInvoice({
      invoiceType: 'non_gst_estimate',
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        villageOrArea: customer.villageOrArea,
      },
      items,
      extraBillDiscount: 0,
      payment: {
        mode: 'cash',
        cashPaid: total,
        upiPaid: 0,
        cardPaid: 0,
        udhaarAmount: 0,
        upiReferenceNote: '',
        notes: '',
      },
    });

    expect(invoiceMatchesSearch(result.invoice, 'IMEI-99887766')).toBe(true);
    expect(invoiceMatchesSearch(result.invoice, '9876543211')).toBe(true);
    expect(
      invoiceMatchesSearch(result.invoice, result.invoice.invoiceNumber),
    ).toBe(true);

    const bySerial = await searchInvoices('IMEI-99887766');
    expect(bySerial.map((invoice) => invoice.id)).toContain(result.invoice.id);

    const byPhone = await searchInvoices('9876543211');
    expect(byPhone.map((invoice) => invoice.id)).toContain(result.invoice.id);
  });
});
