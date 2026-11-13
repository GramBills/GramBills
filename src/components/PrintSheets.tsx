import { createPortal } from 'react-dom';
import type { Invoice, InvoiceItem, ShopSettings } from '../types/pos';
import { formatDate, formatDateTime } from '../lib/date';
import { formatINR, formatINRInWords } from '../lib/money';

export type InvoicePrintFormat =
  | 'a4'
  | 'a5'
  | 'thermal_80mm'
  | 'thermal_58mm';

interface InvoicePrintSheetProps {
  invoice: Invoice;
  settings: ShopSettings;
  format: InvoicePrintFormat;
  qrDataUrl?: string;
}

interface TaxGroup {
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  tax: number;
}

const pageSettings: Record<
  InvoicePrintFormat,
  { page: string; margin: string; width: string; fontSize: string }
> = {
  a4: { page: 'A4', margin: '12mm', width: '186mm', fontSize: '10.5px' },
  a5: { page: 'A5', margin: '8mm', width: '132mm', fontSize: '8.8px' },
  thermal_80mm: {
    page: '80mm auto',
    margin: '3mm',
    width: '74mm',
    fontSize: '10px',
  },
  thermal_58mm: {
    page: '58mm auto',
    margin: '2mm',
    width: '54mm',
    fontSize: '8.5px',
  },
};

function shopInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials || 'GB';
}

function paymentSummary(invoice: Invoice): string[] {
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
  return parts;
}

function paymentStatusLabel(invoice: Invoice): string {
  if (invoice.paymentStatus === 'paid') {
    return 'PAID';
  }
  if (invoice.paymentStatus === 'partial_udhaar') {
    return 'PARTIALLY PAID';
  }
  return 'UDHAAR';
}

function paymentStatusClass(invoice: Invoice): string {
  if (invoice.paymentStatus === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (invoice.paymentStatus === 'partial_udhaar') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function taxGroups(items: InvoiceItem[]): TaxGroup[] {
  const groups = new Map<number, TaxGroup>();
  for (const item of items) {
    const rate = Number(item.gstRate);
    const current = groups.get(rate) ?? {
      rate,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      tax: 0,
    };
    const taxable = Math.max(0, item.lineTotal - item.taxAmount);
    const cgst = item.taxAmount / 2;
    current.taxable += taxable;
    current.cgst += cgst;
    current.sgst += item.taxAmount - cgst;
    current.tax += item.taxAmount;
    groups.set(rate, current);
  }
  return Array.from(groups.values())
    .filter((group) => group.taxable > 0 || group.tax > 0)
    .sort((a, b) => a.rate - b.rate);
}

function InvoiceHeader({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: ShopSettings;
}) {
  return (
    <>
      <header className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-[18px] font-extrabold tracking-wide text-white">
            {shopInitials(settings.shopName)}
          </div>
          <div className="min-w-0">
            <h1 className="text-[23px] font-extrabold leading-tight tracking-tight text-slate-900">
              {settings.shopName}
            </h1>
            <p className="mt-1 max-w-[104mm] text-[9px] leading-4 text-slate-600">
              {settings.address}
            </p>
            <p className="text-[9px] leading-4 text-slate-600">
              Phone: {settings.phone}
              {settings.gstin ? ` · GSTIN: ${settings.gstin}` : ''}
            </p>
            {settings.upiId ? (
              <p className="text-[9px] leading-4 text-slate-500">
                UPI: {settings.upiId}
              </p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="inline-flex rounded-md bg-emerald-700 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white">
            {invoice.invoiceType === 'gst_tax_invoice'
              ? 'Tax Invoice'
              : 'Estimate'}
          </span>
          <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Invoice No.
          </p>
          <p className="text-[15px] font-extrabold tracking-tight text-slate-900">
            {invoice.invoiceNumber}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            {formatDateTime(invoice.createdAt)}
          </p>
          <span
            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wide ${paymentStatusClass(invoice)}`}
          >
            {paymentStatusLabel(invoice)}
          </span>
        </div>
      </header>
      <div className="mt-4 h-[2px] w-full bg-emerald-700" />
    </>
  );
}

function InvoiceMeta({ invoice }: { invoice: Invoice }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Billed To
        </p>
        <p className="mt-1 text-[12px] font-bold leading-5 text-slate-900">
          {invoice.customerName.trim() || 'Walk-in Customer'}
        </p>
        {invoice.customerPhone ? (
          <p className="text-[9px] leading-4 text-slate-600">
            Phone: {invoice.customerPhone}
          </p>
        ) : null}
        {invoice.customerVillage ? (
          <p className="text-[9px] leading-4 text-slate-600">
            {invoice.customerVillage}
          </p>
        ) : null}
        {invoice.customerGstin ? (
          <p className="text-[9px] leading-4 text-slate-600">
            GSTIN: {invoice.customerGstin}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Invoice Details
        </p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[9px] leading-4">
          <dt className="text-slate-500">Type</dt>
          <dd className="text-right font-semibold text-slate-800">
            {invoice.invoiceType === 'gst_tax_invoice'
              ? 'GST Tax Invoice'
              : 'Non-GST Estimate'}
          </dd>
          <dt className="text-slate-500">Payment mode</dt>
          <dd className="text-right font-semibold capitalize text-slate-800">
            {invoice.paymentMode}
          </dd>
          <dt className="text-slate-500">Payment status</dt>
          <dd className="text-right font-semibold text-slate-800">
            {invoice.paymentStatus.replaceAll('_', ' ')}
          </dd>
          <dt className="text-slate-500">Place</dt>
          <dd className="text-right font-semibold text-slate-800">
            {invoice.customerVillage.trim() || '—'}
          </dd>
        </dl>
      </div>
    </div>
  );
}

function InvoiceItemsTable({
  invoice,
  showTax,
}: {
  invoice: Invoice;
  showTax: boolean;
}) {
  return (
    <table className="mt-4 w-full table-fixed border-collapse text-left text-[9px]">
      <thead>
        <tr className="border-y border-slate-300 bg-slate-100 text-[8px] uppercase tracking-wide text-slate-600">
          <th className="w-[6mm] px-1.5 py-2 font-bold">#</th>
          <th className="px-1.5 py-2 font-bold">Item Description</th>
          {showTax ? (
            <th className="w-[10mm] px-1.5 py-2 text-center font-bold">HSN</th>
          ) : null}
          <th className="w-[11mm] px-1.5 py-2 text-right font-bold">Qty</th>
          <th className="w-[15mm] px-1.5 py-2 text-right font-bold">Rate</th>
          <th className="w-[13mm] px-1.5 py-2 text-right font-bold">Disc.</th>
          {showTax ? (
            <th className="w-[15mm] px-1.5 py-2 text-right font-bold">Taxable</th>
          ) : null}
          {showTax ? (
            <th className="w-[13mm] px-1.5 py-2 text-right font-bold">GST</th>
          ) : null}
          <th className="w-[19mm] px-1.5 py-2 text-right font-bold">Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.items.map((item, index) => (
          <tr
            key={item.id}
            className="invoice-avoid-break border-b border-slate-200 align-top"
          >
            <td className="px-1.5 py-2 text-slate-500">{index + 1}</td>
            <td className="px-1.5 py-2">
              <p className="font-semibold leading-4 text-slate-900">
                {item.productName}
              </p>
              {item.barcode ? (
                <p className="mt-0.5 text-[8px] text-slate-500">
                  Barcode: {item.barcode}
                </p>
              ) : null}
              {item.serialOrImeiNumbers.length > 0 ? (
                <p className="text-[8px] text-slate-500">
                  Serial / IMEI: {item.serialOrImeiNumbers.join(', ')}
                </p>
              ) : null}
              {item.warrantyExpiryDate ? (
                <p className="text-[8px] text-slate-500">
                  Warranty till {formatDate(item.warrantyExpiryDate)}
                </p>
              ) : null}
            </td>
            {showTax ? (
              <td className="px-1.5 py-2 text-center text-slate-600">
                {item.hsnCode || '—'}
              </td>
            ) : null}
            <td className="px-1.5 py-2 text-right text-slate-700">
              {item.quantity} {item.unit}
            </td>
            <td className="px-1.5 py-2 text-right text-slate-700">
              {formatINR(item.unitPrice)}
            </td>
            <td className="px-1.5 py-2 text-right text-slate-700">
              {item.discountAmount > 0
                ? formatINR(item.discountAmount)
                : '—'}
            </td>
            {showTax ? (
              <td className="px-1.5 py-2 text-right text-slate-700">
                {formatINR(item.lineTotal - item.taxAmount)}
              </td>
            ) : null}
            {showTax ? (
              <td className="px-1.5 py-2 text-right text-slate-700">
                {formatINR(item.taxAmount)}
                <span className="block text-[8px] text-slate-500">
                  {item.gstRate}%
                </span>
              </td>
            ) : null}
            <td className="px-1.5 py-2 text-right font-bold text-slate-900">
              {formatINR(item.lineTotal)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvoiceTaxSummary({ invoice }: { invoice: Invoice }) {
  const groups = taxGroups(invoice.items);
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="invoice-avoid-break rounded-lg border border-slate-200 p-3">
      <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
        GST Summary
      </p>
      <table className="mt-1 w-full text-[8.5px]">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-1 text-left font-semibold">Rate</th>
            <th className="pb-1 text-right font-semibold">Taxable</th>
            <th className="pb-1 text-right font-semibold">CGST</th>
            <th className="pb-1 text-right font-semibold">SGST</th>
            <th className="pb-1 text-right font-semibold">Total tax</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.rate} className="border-t border-slate-100">
              <td className="py-1 font-semibold text-slate-700">
                {group.rate}%
              </td>
              <td className="py-1 text-right text-slate-600">
                {formatINR(group.taxable)}
              </td>
              <td className="py-1 text-right text-slate-600">
                {formatINR(group.cgst)}
              </td>
              <td className="py-1 text-right text-slate-600">
                {formatINR(group.sgst)}
              </td>
              <td className="py-1 text-right font-semibold text-slate-800">
                {formatINR(group.tax)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTotals({
  invoice,
  showTax,
}: {
  invoice: Invoice;
  showTax: boolean;
}) {
  return (
    <div className="invoice-avoid-break rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="space-y-1.5 text-[9px]">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Subtotal</span>
          <span className="font-medium text-slate-800">
            {formatINR(invoice.subtotal)}
          </span>
        </div>
        {invoice.itemDiscountTotal + invoice.extraBillDiscount > 0 ? (
          <div className="flex justify-between gap-3 text-emerald-700">
            <span>Discount</span>
            <span className="font-medium">
              -{formatINR(invoice.itemDiscountTotal + invoice.extraBillDiscount)}
            </span>
          </div>
        ) : null}
        {showTax ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Taxable value</span>
              <span className="font-medium text-slate-800">
                {formatINR(invoice.taxableAmount)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">CGST</span>
              <span className="font-medium text-slate-800">
                {formatINR(invoice.cgstTotal)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">SGST</span>
              <span className="font-medium text-slate-800">
                {formatINR(invoice.sgstTotal)}
              </span>
            </div>
          </>
        ) : null}
        {invoice.roundOff !== 0 ? (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Round off</span>
            <span className="font-medium text-slate-800">
              {formatINR(invoice.roundOff)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-slate-300 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-900">
          Grand Total
        </span>
        <span className="text-[15px] font-extrabold tracking-tight text-slate-900">
          {formatINR(invoice.grandTotal)}
        </span>
      </div>

      <p className="mt-2 border-t border-slate-200 pt-2 text-[8px] leading-4 text-slate-500">
        <span className="font-semibold text-slate-700">Amount in words:</span>{' '}
        {formatINRInWords(invoice.grandTotal)}
      </p>
    </div>
  );
}

function InvoicePayment({
  invoice,
  settings,
  qrDataUrl,
}: {
  invoice: Invoice;
  settings: ShopSettings;
  qrDataUrl?: string;
}) {
  const parts = paymentSummary(invoice);
  const hasQr = Boolean(qrDataUrl && invoice.upiPaid > 0);

  return (
    <div
      className={`invoice-avoid-break mt-4 grid gap-4 ${
        hasQr ? 'grid-cols-[1fr_38mm]' : 'grid-cols-1'
      }`}
    >
      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Payment Details
        </p>
        <p className="mt-1 text-[9px] font-semibold text-slate-800">
          {parts.join(' · ') || 'Unpaid'}
        </p>
        {invoice.upiReferenceNote ? (
          <p className="mt-1 text-[8.5px] text-slate-600">
            UPI reference: {invoice.upiReferenceNote}
          </p>
        ) : null}
        {invoice.udhaarAmount > 0 ? (
          <p className="mt-1 text-[8.5px] font-semibold text-amber-700">
            Udhaar of {formatINR(invoice.udhaarAmount)} added to customer khata.
          </p>
        ) : null}
        {invoice.notes ? (
          <p className="mt-1 text-[8.5px] leading-4 text-slate-600">
            Note: {invoice.notes}
          </p>
        ) : null}
        {!hasQr ? (
          <p className="mt-2 text-[8px] text-slate-500">
            {settings.termsAndConditions
              ? 'Please retain this invoice for warranty and service claims.'
              : ''}
          </p>
        ) : null}
      </div>

      {hasQr ? (
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <img
            src={qrDataUrl}
            alt="UPI payment QR"
            className="mx-auto h-[28mm] w-[28mm]"
          />
          <p className="mt-1 text-[8px] font-semibold text-slate-700">
            Scan to pay {formatINR(invoice.upiPaid)}
          </p>
          <p className="text-[7.5px] text-slate-500">{settings.upiId}</p>
        </div>
      ) : null}
    </div>
  );
}

function InvoiceFooter({
  settings,
  invoice,
}: {
  settings: ShopSettings;
  invoice: Invoice;
}) {
  return (
    <>
      <div className="invoice-avoid-break mt-5 grid grid-cols-[1fr_55mm] gap-6">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Terms & Conditions
          </p>
          <p className="mt-1 whitespace-pre-line text-[8px] leading-4 text-slate-600">
            {settings.termsAndConditions ||
              'Goods once sold will not be taken back. Warranty as per manufacturer policy.'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">
            For {settings.shopName}
          </p>
          <div className="mt-10 border-t border-slate-400 pt-1 text-[8px] text-slate-500">
            Authorised Signatory
          </div>
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-2 text-[8px] text-slate-500">
        <span>
          {invoice.invoiceType === 'gst_tax_invoice'
            ? 'This is a computer-generated tax invoice.'
            : 'This is a computer-generated estimate.'}
        </span>
        <span className="font-semibold text-slate-700">
          Thank you for your business.
        </span>
      </footer>
    </>
  );
}

function CompactInvoice({
  invoice,
  settings,
  qrDataUrl,
}: {
  invoice: Invoice;
  settings: ShopSettings;
  qrDataUrl?: string;
}) {
  const showTax = invoice.invoiceType === 'gst_tax_invoice';
  const parts = paymentSummary(invoice);

  return (
    <article className="invoice-page bg-white text-slate-900">
      <header className="text-center">
        <h1 className="text-[15px] font-extrabold uppercase leading-tight tracking-wide">
          {settings.shopName}
        </h1>
        {settings.address ? (
          <p className="mt-1 text-[9px] leading-4">{settings.address}</p>
        ) : null}
        <p className="text-[9px] leading-4">
          Phone: {settings.phone}
          {settings.gstin ? ` · GSTIN: ${settings.gstin}` : ''}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide">
          {invoice.invoiceType === 'gst_tax_invoice'
            ? 'Tax Invoice'
            : 'Estimate'}
        </p>
      </header>

      <div className="my-2 border-y border-dashed border-slate-400 py-1 text-[9px] leading-4">
        <div className="flex justify-between gap-2">
          <span>Invoice</span>
          <span className="font-semibold">{invoice.invoiceNumber}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Date</span>
          <span>{formatDateTime(invoice.createdAt)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Customer</span>
          <span className="text-right">
            {invoice.customerName.trim() || 'Walk-in'}
          </span>
        </div>
        {invoice.customerPhone ? (
          <div className="flex justify-between gap-2">
            <span>Phone</span>
            <span>{invoice.customerPhone}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <span>Payment</span>
          <span className="capitalize">{invoice.paymentMode}</span>
        </div>
      </div>

      <div className="flex border-b border-dashed border-slate-400 py-1 text-[8px] font-bold uppercase">
        <span className="flex-1">Item</span>
        <span className="w-8 text-right">Qty</span>
        <span className="w-14 text-right">Amount</span>
      </div>
      {invoice.items.map((item) => (
        <div
          key={item.id}
          className="flex border-b border-dashed border-slate-200 py-1 text-[9px]"
        >
          <span className="min-w-0 flex-1 pr-1">
            {item.productName}
            {item.serialOrImeiNumbers.length > 0 ? (
              <span className="block text-[7.5px] text-slate-500">
                {item.serialOrImeiNumbers.join(', ')}
              </span>
            ) : null}
            {item.warrantyExpiryDate ? (
              <span className="block text-[7.5px] text-slate-500">
                Warranty till {formatDate(item.warrantyExpiryDate)}
              </span>
            ) : null}
          </span>
          <span className="w-8 text-right">
            {item.quantity} {item.unit}
          </span>
          <span className="w-14 text-right font-semibold">
            {formatINR(item.lineTotal)}
          </span>
        </div>
      ))}

      <div className="mt-2 border-t border-dashed border-slate-400 pt-1 text-[9px]">
        <div className="flex justify-between gap-2">
          <span>Subtotal</span>
          <span>{formatINR(invoice.subtotal)}</span>
        </div>
        {invoice.itemDiscountTotal + invoice.extraBillDiscount > 0 ? (
          <div className="flex justify-between gap-2 text-emerald-700">
            <span>Discount</span>
            <span>
              -{formatINR(invoice.itemDiscountTotal + invoice.extraBillDiscount)}
            </span>
          </div>
        ) : null}
        {showTax ? (
          <>
            <div className="flex justify-between gap-2">
              <span>CGST</span>
              <span>{formatINR(invoice.cgstTotal)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>SGST</span>
              <span>{formatINR(invoice.sgstTotal)}</span>
            </div>
          </>
        ) : null}
        {invoice.roundOff !== 0 ? (
          <div className="flex justify-between gap-2">
            <span>Round off</span>
            <span>{formatINR(invoice.roundOff)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between gap-2 border-t border-slate-400 pt-1 text-[12px] font-bold">
          <span>Grand Total</span>
          <span>{formatINR(invoice.grandTotal)}</span>
        </div>
        <p className="mt-1 text-[8px] leading-4 text-slate-600">
          {formatINRInWords(invoice.grandTotal)}
        </p>
        <p className="mt-1 text-[8.5px]">
          {parts.join(' + ') || 'Unpaid'}
        </p>
      </div>

      {qrDataUrl && invoice.upiPaid > 0 ? (
        <div className="mt-2 flex items-center gap-2">
          <img src={qrDataUrl} alt="UPI payment QR" className="h-20 w-20" />
          <div className="text-[8px] leading-4">
            <p className="font-semibold">UPI payment request</p>
            <p>Scan to pay {formatINR(invoice.upiPaid)}</p>
            <p>{settings.upiId}</p>
          </div>
        </div>
      ) : null}

      {invoice.upiReferenceNote ? (
        <p className="mt-1 text-[8px]">
          UPI reference: {invoice.upiReferenceNote}
        </p>
      ) : null}
      {invoice.notes ? (
        <p className="mt-1 text-[8px]">Note: {invoice.notes}</p>
      ) : null}
      <p className="mt-2 whitespace-pre-line text-[8px] leading-4 text-slate-600">
        {settings.termsAndConditions}
      </p>
      <p className="mt-2 text-center text-[8px] font-semibold">
        Thank you for your business.
      </p>
    </article>
  );
}

export function InvoicePrintSheet({
  invoice,
  settings,
  format,
  qrDataUrl,
}: InvoicePrintSheetProps) {
  const page = pageSettings[format];
  const compact = format === 'thermal_80mm' || format === 'thermal_58mm';
  const showTax = invoice.invoiceType === 'gst_tax_invoice';

  return createPortal(
    <div className="invoice-print-sheet print-only">
      <style>{`@page { size: ${page.page}; margin: ${page.margin}; }`}</style>
      {compact ? (
        <CompactInvoice
          invoice={invoice}
          settings={settings}
          qrDataUrl={qrDataUrl}
        />
      ) : (
        <article
          className="invoice-page bg-white text-slate-900"
          style={{ width: page.width, fontSize: page.fontSize }}
        >
          <InvoiceHeader invoice={invoice} settings={settings} />
          <InvoiceMeta invoice={invoice} />
          <InvoiceItemsTable invoice={invoice} showTax={showTax} />
          <div className="mt-4 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              {showTax ? <InvoiceTaxSummary invoice={invoice} /> : null}
            </div>
            <div className="w-[62mm] shrink-0">
              <InvoiceTotals invoice={invoice} showTax={showTax} />
            </div>
          </div>
          <InvoicePayment
            invoice={invoice}
            settings={settings}
            qrDataUrl={qrDataUrl}
          />
          <InvoiceFooter settings={settings} invoice={invoice} />
        </article>
      )}
    </div>,
    document.body,
  );
}
