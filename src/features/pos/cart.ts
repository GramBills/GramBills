import { calculateInvoice } from '../../lib/gst';
import type { GstInvoiceTotals, GstLineTotals } from '../../lib/gst';
import { round2 } from '../../lib/money';
import type {
  CheckoutCustomerInput,
  CheckoutLineInput,
} from '../../services/invoices';
import type {
  GstRate,
  InvoiceType,
  Product,
  Unit,
} from '../../types/pos';

export const HOLD_SLOT_COUNT = 5;
const HOLD_STORAGE_KEY = 'grambill-holds-v1';

export interface CartLine {
  id: string;
  productId: string;
  name: string;
  barcode: string;
  unit: Unit;
  mrp: number;
  unitPrice: number;
  minSellingPrice: number;
  purchasePrice: number;
  gstRate: GstRate;
  taxInclusive: boolean;
  trackSerialImei: boolean;
  stockQty: number;
  quantity: number;
  discountAmount: number;
  discountPercent: number;
  serialOrImeiNumbers: string[];
  warrantyMonths: number;
}

export interface HoldBill {
  items: CartLine[];
  extraBillDiscount: number;
  invoiceType: InvoiceType;
  customer: CheckoutCustomerInput | null;
  updatedAt: string;
}

export type HoldSlots = (HoldBill | null)[];

export function emptyHoldSlots(): HoldSlots {
  return Array.from({ length: HOLD_SLOT_COUNT }, () => null);
}

export function cartLineFromProduct(product: Product): CartLine {
  return {
    id: `line-${product.id}`,
    productId: product.id,
    name: product.name,
    barcode: product.barcode,
    unit: product.unit,
    mrp: product.mrp,
    unitPrice: product.sellingPrice,
    minSellingPrice: product.minSellingPrice,
    purchasePrice: product.purchasePrice,
    gstRate: product.gstRate,
    taxInclusive: product.taxInclusive,
    trackSerialImei: product.trackSerialImei,
    stockQty: product.stockQty,
    quantity: 1,
    discountAmount: 0,
    discountPercent: 0,
    serialOrImeiNumbers: [],
    warrantyMonths: product.defaultWarrantyMonths,
  };
}

export function toCheckoutLine(line: CartLine): CheckoutLineInput {
  return {
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    discountPercent: line.discountPercent,
    serialOrImeiNumbers: line.serialOrImeiNumbers,
    warrantyMonths: line.warrantyMonths,
  };
}

export function calculateCartLine(
  line: CartLine,
  invoiceType: InvoiceType = 'gst_tax_invoice',
): GstLineTotals {
  return calculateInvoice(
    [
      {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        gstRate: line.gstRate,
        taxInclusive: line.taxInclusive,
      },
    ],
    0,
    invoiceType,
  ).lines[0];
}

export function calculateCart(
  lines: CartLine[],
  extraBillDiscount = 0,
  invoiceType: InvoiceType = 'gst_tax_invoice',
): GstInvoiceTotals {
  return calculateInvoice(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      gstRate: line.gstRate,
      taxInclusive: line.taxInclusive,
    })),
    extraBillDiscount,
    invoiceType,
  ).totals;
}

export function withPercentDiscount(
  line: CartLine,
  percent: number,
): CartLine {
  const discountPercent = Math.min(100, Math.max(0, round2(percent)));
  const grossAmount = round2(line.quantity * line.unitPrice);
  const discountAmount = round2(
    Math.min(grossAmount, (grossAmount * discountPercent) / 100),
  );
  return { ...line, discountPercent, discountAmount };
}

export function isBelowFloorPrice(line: CartLine): boolean {
  return line.unitPrice < line.minSellingPrice;
}

export function lineDiscountTotal(line: CartLine): number {
  return Math.min(
    Math.max(0, line.discountAmount),
    line.quantity * line.unitPrice,
  );
}

export function loadHoldSlots(): HoldSlots {
  const slots = emptyHoldSlots();
  if (typeof window === 'undefined') {
    return slots;
  }
  try {
    const raw = window.localStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) {
      return slots;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return slots;
    }
    for (let index = 0; index < HOLD_SLOT_COUNT; index += 1) {
      const value = parsed[index] as HoldBill | null | undefined;
      if (
        value &&
        Array.isArray(value.items) &&
        typeof value.updatedAt === 'string'
      ) {
        slots[index] = {
          ...value,
          items: value.items.map((item) =>
            typeof item.discountPercent === 'number'
              ? item
              : {
                  ...item,
                  discountPercent:
                    item.quantity * item.unitPrice > 0
                      ? round2(
                          (item.discountAmount /
                            (item.quantity * item.unitPrice)) *
                            100,
                        )
                      : 0,
                },
          ),
        };
      }
    }
  } catch {
    return slots;
  }
  return slots;
}

export function saveHoldSlots(slots: HoldSlots): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    return;
  }
}
