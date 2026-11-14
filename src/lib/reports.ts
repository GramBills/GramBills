import type {
  Invoice,
  KhataTransaction,
  Product,
} from '../types/pos';
import { formatDate } from './date';
import { round2 } from './money';

export type ReportRangeKey =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface ReportProductRow {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface ReportLowStockRow {
  productId: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  stockQty: number;
  threshold: number;
  suggestedQty: number;
}

export interface ReportSummary {
  invoiceCount: number;
  cancelledCount: number;
  salesTotal: number;
  taxTotal: number;
  cashCollected: number;
  upiCollected: number;
  cardCollected: number;
  invoiceCash: number;
  invoiceUpi: number;
  invoiceCard: number;
  khataCash: number;
  khataUpi: number;
  newUdhaar: number;
  udhaarCollected: number;
  netProfit: number;
  marginPercent: number;
  averageBill: number;
  topProducts: ReportProductRow[];
  lowStock: ReportLowStockRow[];
}

function startOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0,
  );
}

function endOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function getReportRange(
  key: Exclude<ReportRangeKey, 'custom'>,
  now: Date = new Date(),
): DateRange {
  if (key === 'today') {
    return { start: startOfDay(now), end: endOfDay(now), label: 'Today' };
  }
  if (key === 'yesterday') {
    const yesterday = addDays(now, -1);
    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
      label: 'Yesterday',
    };
  }
  if (key === 'week') {
    return {
      start: startOfDay(addDays(now, -6)),
      end: endOfDay(now),
      label: 'Last 7 days',
    };
  }
  return {
    start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: endOfDay(now),
    label: 'This month',
  };
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCustomReportRange(
  startDate: string,
  endDate: string,
): DateRange {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end) {
    throw new Error('Choose a valid start and end date.');
  }
  if (startOfDay(end) < startOfDay(start)) {
    throw new Error('End date cannot be before the start date.');
  }
  return {
    start: startOfDay(start),
    end: endOfDay(end),
    label: `${formatDate(start)} to ${formatDate(end)}`,
  };
}

function isInRange(value: string, range: DateRange): boolean {
  const time = new Date(value).getTime();
  return (
    Number.isFinite(time) &&
    time >= range.start.getTime() &&
    time <= range.end.getTime()
  );
}

export function buildReportSummary(
  invoices: Invoice[],
  khataTransactions: KhataTransaction[],
  products: Product[],
  range: DateRange,
): ReportSummary {
  const rangeInvoices = invoices.filter(
    (invoice) =>
      isInRange(invoice.createdAt, range) && invoice.status === 'completed',
  );
  const cancelledCount = invoices.filter(
    (invoice) =>
      isInRange(invoice.createdAt, range) && invoice.status !== 'completed',
  ).length;
  const payments = khataTransactions.filter(
    (transaction) =>
      transaction.type === 'payment_received' &&
      isInRange(transaction.createdAt, range),
  );

  const invoiceCash = round2(
    rangeInvoices.reduce((total, invoice) => total + invoice.cashPaid, 0),
  );
  const invoiceUpi = round2(
    rangeInvoices.reduce((total, invoice) => total + invoice.upiPaid, 0),
  );
  const invoiceCard = round2(
    rangeInvoices.reduce((total, invoice) => total + invoice.cardPaid, 0),
  );
  const khataCash = round2(
    payments
      .filter((transaction) => transaction.paymentMode === 'cash')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );
  const khataUpi = round2(
    payments
      .filter((transaction) => transaction.paymentMode === 'upi')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  const salesTotal = round2(
    rangeInvoices.reduce((total, invoice) => total + invoice.grandTotal, 0),
  );
  const taxTotal = round2(
    rangeInvoices.reduce(
      (total, invoice) => total + invoice.cgstTotal + invoice.sgstTotal,
      0,
    ),
  );
  const netProfit = round2(
    rangeInvoices.reduce(
      (total, invoice) =>
        total +
        invoice.grandTotal -
        invoice.cgstTotal -
        invoice.sgstTotal -
        invoice.totalCostPrice,
      0,
    ),
  );
  const taxableRevenue = round2(salesTotal - taxTotal);
  const marginPercent =
    taxableRevenue > 0 ? round2((netProfit / taxableRevenue) * 100) : 0;

  const productMap = new Map(products.map((product) => [product.id, product]));
  const topProductMap = new Map<string, ReportProductRow>();
  for (const invoice of rangeInvoices) {
    for (const item of invoice.items) {
      const current = topProductMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
      const costPrice =
        item.costPrice ??
        productMap.get(item.productId)?.purchasePrice ??
        0;
      current.quantity = round2(current.quantity + item.quantity);
      current.revenue = round2(current.revenue + item.lineTotal);
      current.profit = round2(
        current.profit + item.lineTotal - item.taxAmount - costPrice * item.quantity,
      );
      topProductMap.set(item.productId, current);
    }
  }

  const lowStock = products
    .filter(
      (product) =>
        !product.deletedAt && product.stockQty <= product.lowStockThreshold,
    )
    .map((product) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand,
      unit: product.unit,
      stockQty: product.stockQty,
      threshold: product.lowStockThreshold,
      suggestedQty: Math.max(
        1,
        Math.ceil(product.lowStockThreshold * 2 - product.stockQty),
      ),
    }))
    .sort((a, b) => {
      if (a.stockQty === 0 && b.stockQty !== 0) {
        return -1;
      }
      if (b.stockQty === 0 && a.stockQty !== 0) {
        return 1;
      }
      return a.stockQty - b.stockQty;
    });

  return {
    invoiceCount: rangeInvoices.length,
    cancelledCount,
    salesTotal,
    taxTotal,
    cashCollected: round2(invoiceCash + khataCash),
    upiCollected: round2(invoiceUpi + khataUpi),
    cardCollected: invoiceCard,
    invoiceCash,
    invoiceUpi,
    invoiceCard,
    khataCash,
    khataUpi,
    newUdhaar: round2(
      rangeInvoices.reduce((total, invoice) => total + invoice.udhaarAmount, 0),
    ),
    udhaarCollected: round2(
      payments.reduce((total, transaction) => total + transaction.amount, 0),
    ),
    netProfit,
    marginPercent,
    averageBill:
      rangeInvoices.length > 0
        ? round2(salesTotal / rangeInvoices.length)
        : 0,
    topProducts: Array.from(topProductMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    lowStock,
  };
}
