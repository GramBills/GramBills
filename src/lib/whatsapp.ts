import type { Invoice, ShopSettings } from '../types/pos';
import { formatDate } from './date';
import { formatINR } from './money';

export interface ReceiptMessageOptions {
  customerBalance?: number;
}

function paymentSummary(invoice: Invoice): string {
  const parts: string[] = [];
  if (invoice.cashPaid > 0) {
    parts.push(`Cash ${formatINR(invoice.cashPaid)}`);
  }
  if (invoice.upiPaid > 0) {
    parts.push(`UPI ${formatINR(invoice.upiPaid)}`);
  }
  if (invoice.cardPaid > 0) {
    parts.push(`Card ${formatINR(invoice.cardPaid)}`);
  }
  if (invoice.udhaarAmount > 0) {
    parts.push(`Udhaar ${formatINR(invoice.udhaarAmount)}`);
  }
  return parts.join(' + ') || 'Unpaid';
}

export function buildReceiptMessage(
  invoice: Invoice,
  settings: ShopSettings,
  options: ReceiptMessageOptions = {},
): string {
  const lines: string[] = [
    `*${settings.shopName}*`,
    `Bill: ${invoice.invoiceNumber}`,
    `Date: ${formatDate(invoice.createdAt)}`,
  ];

  if (invoice.customerName.trim()) {
    lines.push(`Customer: ${invoice.customerName.trim()}`);
  }

  lines.push('', '*Items*');
  invoice.items.forEach((item, index) => {
    const warranty = item.warrantyExpiryDate
      ? ` | Warranty till ${formatDate(item.warrantyExpiryDate)}`
      : '';
    const serials =
      item.serialOrImeiNumbers.length > 0
        ? ` | ${item.serialOrImeiNumbers.join(', ')}`
        : '';
    lines.push(
      `${index + 1}. ${item.productName} x ${item.quantity} = ${formatINR(
        item.lineTotal,
      )}${warranty}${serials}`,
    );
  });

  lines.push(
    '',
    `Subtotal: ${formatINR(invoice.subtotal)}`,
  );
  if (invoice.itemDiscountTotal + invoice.extraBillDiscount > 0) {
    lines.push(
      `Discount: ${formatINR(
        invoice.itemDiscountTotal + invoice.extraBillDiscount,
      )}`,
    );
  }
  lines.push(
    `Tax: ${formatINR(invoice.cgstTotal + invoice.sgstTotal)}`,
    `Total: ${formatINR(invoice.grandTotal)}`,
    `Paid: ${paymentSummary(invoice)}`,
  );

  if (invoice.udhaarAmount > 0 && options.customerBalance !== undefined) {
    lines.push(`Udhaar balance: ${formatINR(options.customerBalance)}`);
  }

  if (invoice.notes.trim()) {
    lines.push('', invoice.notes.trim());
  }

  lines.push('', 'Thank you for shopping with us.');
  return lines.join('\n');
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    return '';
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
