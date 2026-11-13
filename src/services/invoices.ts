import { LOCAL_DEVICE_ID, LOCAL_SHOP_ID } from '../db/constants';
import { db } from '../db/database';
import { nowIso, warrantyExpiryDate } from '../lib/date';
import { calculateInvoice } from '../lib/gst';
import { newId } from '../lib/id';
import { formatInvoiceNumber } from '../lib/invoiceNumber';
import { round2 } from '../lib/money';
import type {
  Customer,
  Invoice,
  InvoiceItem,
  InvoiceType,
  KhataTransaction,
  PaymentMode,
  PaymentStatus,
  Product,
  StockMovement,
} from '../types/pos';
import { normalizePhone } from './customers';

export interface CheckoutLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  serialOrImeiNumbers: string[];
  warrantyMonths: number;
}

export interface CheckoutCustomerInput {
  id?: string;
  name: string;
  phone: string;
  villageOrArea: string;
  gstin?: string;
}

export interface CheckoutPaymentInput {
  mode: PaymentMode;
  cashPaid: number;
  upiPaid: number;
  cardPaid: number;
  udhaarAmount: number;
  upiReferenceNote: string;
  notes: string;
}

export interface CheckoutInput {
  invoiceType: InvoiceType;
  customer: CheckoutCustomerInput | null;
  items: CheckoutLineInput[];
  extraBillDiscount: number;
  payment: CheckoutPaymentInput;
  allowBelowFloor?: boolean;
}

export interface CheckoutResult {
  invoice: Invoice;
  customer: Customer | null;
}

function safeMoney(value: number): number {
  return round2(Number.isFinite(value) ? Math.max(0, value) : 0);
}

function resolvePaymentMode(
  payment: CheckoutPaymentInput,
  paidTotal: number,
  udhaarAmount: number,
): PaymentMode {
  if (udhaarAmount > 0 && paidTotal > 0) {
    return 'split';
  }
  if (udhaarAmount > 0) {
    return 'udhaar';
  }
  const nonZero = [
    payment.cashPaid > 0 ? 'cash' : '',
    payment.upiPaid > 0 ? 'upi' : '',
    payment.cardPaid > 0 ? 'card' : '',
  ].filter(Boolean);
  if (nonZero.length > 1) {
    return 'split';
  }
  if (nonZero.length === 1) {
    return nonZero[0] as PaymentMode;
  }
  return payment.mode;
}

function resolvePaymentStatus(
  paidTotal: number,
  udhaarAmount: number,
): PaymentStatus {
  if (udhaarAmount <= 0) {
    return 'paid';
  }
  return paidTotal > 0 ? 'partial_udhaar' : 'full_udhaar';
}

function makeStockMovement(
  productId: string,
  quantity: number,
  invoiceId: string,
  now: string,
): StockMovement {
  return {
    id: newId(),
    shopId: LOCAL_SHOP_ID,
    deviceId: LOCAL_DEVICE_ID,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    productId,
    changeType: 'sale_out',
    qtyChange: -quantity,
    referenceId: invoiceId,
  };
}

function makeKhataCredit(
  customerId: string,
  invoiceId: string,
  amount: number,
  balanceAfter: number,
  invoiceNumber: string,
  now: string,
): KhataTransaction {
  return {
    id: newId(),
    shopId: LOCAL_SHOP_ID,
    deviceId: LOCAL_DEVICE_ID,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    customerId,
    invoiceId,
    type: 'credit_given',
    amount,
    paymentMode: 'none',
    balanceAfter,
    remarks: `Invoice ${invoiceNumber}`,
  };
}

function createCustomerRecord(
  input: CheckoutCustomerInput,
  now: string,
): Customer {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (name === '') {
    throw new Error('Customer name is required for an udhaar bill.');
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new Error('Enter a valid 10-digit customer phone number.');
  }
  return {
    id: newId(),
    shopId: LOCAL_SHOP_ID,
    deviceId: LOCAL_DEVICE_ID,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    name,
    phone,
    villageOrArea: input.villageOrArea.trim(),
    gstin: input.gstin?.trim().toUpperCase() ?? '',
    currentUdhaarBalance: 0,
    creditLimit: 0,
    totalPurchases: 0,
    lastVisitDate: now,
  };
}

export async function createInvoice(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  if (input.items.length === 0) {
    throw new Error('Add at least one product to the bill.');
  }

  return db.transaction(
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
      const settings = await db.shopSettings.get(LOCAL_SHOP_ID);
      if (!settings) {
        throw new Error('Shop settings have not been initialized.');
      }

      const products = new Map<string, Product>();
      for (const line of input.items) {
        const product = await db.products.get(line.productId);
        if (!product || product.deletedAt) {
          throw new Error('One of the selected products is no longer available.');
        }
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          throw new Error(`Enter a valid quantity for ${product.name}.`);
        }
        if (round2(line.quantity) > round2(product.stockQty)) {
          throw new Error(
            `Only ${product.stockQty} ${product.unit} of ${product.name} is in stock.`,
          );
        }
        if (line.unitPrice < product.minSellingPrice && !input.allowBelowFloor) {
          throw new Error(
            `${product.name} is below the floor price. Confirm the override before checkout.`,
          );
        }
        const serials = line.serialOrImeiNumbers
          .map((serial) => serial.trim())
          .filter(Boolean);
        if (
          product.trackSerialImei &&
          serials.length !== round2(line.quantity)
        ) {
          throw new Error(
            `Enter ${round2(line.quantity)} serial/IMEI number${
              round2(line.quantity) === 1 ? '' : 's'
            } for ${product.name}.`,
          );
        }
        products.set(product.id, product);
      }

      const calculation = calculateInvoice(
        input.items.map((line) => {
          const product = products.get(line.productId);
          return {
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            gstRate: product?.gstRate ?? 0,
            taxInclusive: product?.taxInclusive ?? true,
          };
        }),
        input.extraBillDiscount,
      );

      const cashPaid = safeMoney(input.payment.cashPaid);
      const upiPaid = safeMoney(input.payment.upiPaid);
      const cardPaid = safeMoney(input.payment.cardPaid);
      const udhaarAmount = safeMoney(input.payment.udhaarAmount);
      const paidTotal = round2(cashPaid + upiPaid + cardPaid);
      const paymentTotal = round2(paidTotal + udhaarAmount);
      if (Math.abs(paymentTotal - calculation.totals.grandTotal) > 0.01) {
        throw new Error(
          `Payment total must equal the bill total of ${calculation.totals.grandTotal}.`,
        );
      }
      if (udhaarAmount > 0) {
        if (!input.customer || input.customer.name.trim() === '') {
          throw new Error('Select or add a customer for an udhaar bill.');
        }
        if (normalizePhone(input.customer.phone) === '') {
          throw new Error('A phone number is required for an udhaar bill.');
        }
      }

      const now = nowIso();
      let customer: Customer | null = null;
      if (input.customer?.id) {
        customer = (await db.customers.get(input.customer.id)) ?? null;
        if (!customer) {
          throw new Error('The selected customer was not found.');
        }
      } else if (
        input.customer &&
        (input.customer.name.trim() !== '' || input.customer.phone.trim() !== '')
      ) {
        const phone = normalizePhone(input.customer.phone);
        customer = phone
          ? ((await db.customers.where('phone').equals(phone).first()) ?? null)
          : null;
        if (!customer) {
          customer = createCustomerRecord(input.customer, now);
          await db.customers.add(customer);
        }
      }

      let sequence = settings.nextInvoiceNumber;
      let invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, sequence);
      while (
        await db.invoices.where('invoiceNumber').equals(invoiceNumber).first()
      ) {
        sequence += 1;
        invoiceNumber = formatInvoiceNumber(settings.invoicePrefix, sequence);
      }

      const invoiceId = newId();
      const invoiceItems: InvoiceItem[] = input.items.map((line, index) => {
        const product = products.get(line.productId) as Product;
        const lineTotals = calculation.lines[index];
        const quantity = round2(line.quantity);
        const warrantyMonths = Math.max(
          0,
          Math.trunc(Number.isFinite(line.warrantyMonths)
            ? line.warrantyMonths
            : product.defaultWarrantyMonths),
        );
        return {
          id: newId(),
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          hsnCode: product.hsnCode,
          quantity,
          unit: product.unit,
          mrp: product.mrp,
          unitPrice: round2(line.unitPrice),
          discountAmount: lineTotals.itemDiscountAmount,
          gstRate: product.gstRate,
          taxAmount: lineTotals.taxAmount,
          lineTotal: lineTotals.totalAmount,
          serialOrImeiNumbers: line.serialOrImeiNumbers
            .map((serial) => serial.trim())
            .filter(Boolean),
          warrantyMonths,
          warrantyExpiryDate: warrantyExpiryDate(now, warrantyMonths),
        };
      });

      const totalCostPrice = round2(
        input.items.reduce((total, line) => {
          const product = products.get(line.productId) as Product;
          return total + product.purchasePrice * line.quantity;
        }, 0),
      );

      const invoice: Invoice = {
        id: invoiceId,
        shopId: LOCAL_SHOP_ID,
        deviceId: LOCAL_DEVICE_ID,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        invoiceNumber,
        invoiceType: input.invoiceType,
        customerId: customer?.id ?? null,
        customerName:
          customer?.name ?? input.customer?.name.trim() ?? '',
        customerPhone:
          customer?.phone ?? normalizePhone(input.customer?.phone ?? ''),
        customerVillage:
          customer?.villageOrArea ?? input.customer?.villageOrArea.trim() ?? '',
        customerGstin: customer?.gstin ?? input.customer?.gstin?.trim() ?? '',
        items: invoiceItems,
        subtotal: calculation.totals.subtotal,
        itemDiscountTotal: calculation.totals.itemDiscountTotal,
        extraBillDiscount: calculation.totals.extraBillDiscount,
        taxableAmount: calculation.totals.taxableAmount,
        cgstTotal: calculation.totals.cgstTotal,
        sgstTotal: calculation.totals.sgstTotal,
        roundOff: calculation.totals.roundOff,
        grandTotal: calculation.totals.grandTotal,
        totalCostPrice,
        paymentStatus: resolvePaymentStatus(paidTotal, udhaarAmount),
        paymentMode: resolvePaymentMode(
          input.payment,
          paidTotal,
          udhaarAmount,
        ),
        cashPaid,
        upiPaid,
        cardPaid,
        udhaarAmount,
        upiReferenceNote: input.payment.upiReferenceNote.trim(),
        notes: input.payment.notes.trim(),
        status: 'completed',
      };

      await db.invoices.add(invoice);
      await db.shopSettings.update(settings.id, {
        nextInvoiceNumber: sequence + 1,
        updatedAt: now,
        syncStatus: 'pending',
      });

      const soldByProduct = new Map<string, number>();
      for (const line of input.items) {
        soldByProduct.set(
          line.productId,
          round2((soldByProduct.get(line.productId) ?? 0) + line.quantity),
        );
      }
      for (const [productId, quantity] of soldByProduct) {
        const product = products.get(productId) as Product;
        await db.products.update(product.id, {
          stockQty: round2(product.stockQty - quantity),
          updatedAt: now,
          syncStatus: 'pending',
        });
        await db.stockMovements.add(
          makeStockMovement(product.id, quantity, invoice.id, now),
        );
      }

      if (customer) {
        const nextBalance = round2(customer.currentUdhaarBalance + udhaarAmount);
        const updatedCustomer: Customer = {
          ...customer,
          currentUdhaarBalance: nextBalance,
          totalPurchases: round2(customer.totalPurchases + invoice.grandTotal),
          lastVisitDate: now,
          updatedAt: now,
          syncStatus: 'pending',
        };
        await db.customers.put(updatedCustomer);
        customer = updatedCustomer;

        if (udhaarAmount > 0) {
          await db.khataTransactions.add(
            makeKhataCredit(
              customer.id,
              invoice.id,
              udhaarAmount,
              nextBalance,
              invoice.invoiceNumber,
              now,
            ),
          );
        }
      }

      return { invoice, customer };
    },
  );
}
