import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  Printer,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
import type { Invoice, ShopSettings } from '../../types/pos';
import { formatDate, formatDateTime } from '../../lib/date';
import { formatINR } from '../../lib/money';
import {
  buildReceiptMessage,
  buildWhatsAppUrl,
} from '../../lib/whatsapp';
import {
  Badge,
  Button,
  Modal,
} from '../../components/ui/primitives';
import {
  InvoicePrintSheet,
  type InvoicePrintFormat,
} from '../../components/PrintSheets';
import { UpiQr } from './UpiQr';
import { useUpiQrDataUrl } from './useUpiQrDataUrl';

interface InvoiceReceiptModalProps {
  open: boolean;
  invoice: Invoice;
  settings: ShopSettings;
  customerBalance?: number;
  onClose: () => void;
  onNewBill: () => void;
}

export function InvoiceReceiptModal({
  open,
  invoice,
  settings,
  customerBalance,
  onClose,
  onNewBill,
}: InvoiceReceiptModalProps) {
  const [printFormat, setPrintFormat] =
    useState<InvoicePrintFormat | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const printTimerRef = useRef<number | null>(null);
  const qrDataUrl = useUpiQrDataUrl(
    settings,
    invoice.upiPaid,
    `Bill ${invoice.invoiceNumber}`,
  );

  useEffect(() => {
    if (!open) {
      setPrintFormat(null);
      setNotice(null);
    }
    return () => {
      if (printTimerRef.current !== null) {
        window.clearTimeout(printTimerRef.current);
      }
    };
  }, [open]);

  function handlePrint(format: InvoicePrintFormat) {
    setPrintFormat(format);
    if (printTimerRef.current !== null) {
      window.clearTimeout(printTimerRef.current);
    }
    printTimerRef.current = window.setTimeout(() => {
      window.print();
    }, 120);
  }

  function handleWhatsApp() {
    const message = buildReceiptMessage(invoice, settings, {
      customerBalance,
    });
    const url = buildWhatsAppUrl(invoice.customerPhone, message);
    if (!url) {
      setNotice('Add the customer phone number to share this bill on WhatsApp.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <Modal
        open={open}
        title="Bill completed"
        description={`${invoice.invoiceNumber} · ${formatINR(
          invoice.grandTotal,
        )}`}
        onClose={onClose}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Back to counter
            </Button>
            <Button onClick={onNewBill}>
              <RotateCcw className="h-4 w-4" />
              New bill
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-base font-bold text-slate-900">
              {settings.shopName}
            </p>
            {settings.address ? (
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {settings.address}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              Phone: {settings.phone}
              {settings.gstin ? ` · GSTIN: ${settings.gstin}` : ''}
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Bill saved and stock updated.
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">
                Invoice, stock movement, customer total and khata entry were
                saved together on this laptop.
              </p>
            </div>
          </div>

          {notice ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {notice}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invoice
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {invoice.invoiceNumber}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateTime(invoice.createdAt)}
              </p>
              <Badge
                variant={
                  invoice.invoiceType === 'gst_tax_invoice'
                    ? 'success'
                    : 'info'
                }
                className="mt-3"
              >
                {invoice.invoiceType === 'gst_tax_invoice'
                  ? 'GST invoice'
                  : 'Estimate / non-GST'}
              </Badge>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {invoice.customerName.trim() || 'Walk-in customer'}
              </p>
              <p className="text-xs text-slate-500">
                {invoice.customerPhone || 'No phone saved'}
              </p>
              {customerBalance !== undefined && invoice.udhaarAmount > 0 ? (
                <p className="mt-3 text-sm font-semibold text-rose-600">
                  Udhaar balance: {formatINR(customerBalance)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ReceiptText className="h-4 w-4 text-slate-400" />
                Items
              </h3>
              <span className="text-xs text-slate-500">
                {invoice.items.length} item
                {invoice.items.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {invoice.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} {item.unit} × {formatINR(item.unitPrice)}
                      {item.discountAmount > 0
                        ? ` · ${item.discountPercent ?? 0}% off`
                        : ''}
                      {item.warrantyExpiryDate
                        ? ` · Warranty till ${formatDate(
                            item.warrantyExpiryDate,
                          )}`
                        : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-900">
                    {formatINR(item.lineTotal)}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatINR(invoice.subtotal)}</span>
              </div>
              {invoice.itemDiscountTotal + invoice.extraBillDiscount > 0 ? (
                <div className="flex justify-between gap-3 text-emerald-700">
                  <span>Discount</span>
                  <span>
                    -
                    {formatINR(
                      invoice.itemDiscountTotal + invoice.extraBillDiscount,
                    )}
                  </span>
                </div>
              ) : null}
              {invoice.invoiceType === 'gst_tax_invoice' ? (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">GST</span>
                  <span>
                    {formatINR(invoice.cgstTotal + invoice.sgstTotal)}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">GST</span>
                  <span className="text-slate-400">Not charged</span>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatINR(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Payment
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {invoice.cashPaid > 0
                  ? `Cash ${formatINR(invoice.cashPaid)} `
                  : ''}
                {invoice.upiPaid > 0
                  ? `UPI ${formatINR(invoice.upiPaid)} `
                  : ''}
                {invoice.cardPaid > 0
                  ? `Card ${formatINR(invoice.cardPaid)} `
                  : ''}
                {invoice.udhaarAmount > 0
                  ? `Udhaar ${formatINR(invoice.udhaarAmount)}`
                  : ''}
              </p>
            </div>
            {invoice.upiPaid > 0 ? (
              <UpiQr
                settings={settings}
                amount={invoice.upiPaid}
                note={`Bill ${invoice.invoiceNumber}`}
                size={108}
              />
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button onClick={() => handlePrint('a4')}>
              <Printer className="h-4 w-4" />
              Print A4 bill
            </Button>
            <Button
              variant="secondary"
              onClick={() => handlePrint('thermal_80mm')}
            >
              <Printer className="h-4 w-4" />
              Print thermal
            </Button>
            <Button variant="secondary" onClick={handleWhatsApp}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp bill
            </Button>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            A4 printing uses the browser print dialog. Choose 100% / Actual
            size and disable headers and footers.
          </p>
        </div>
      </Modal>

      {printFormat ? (
        <InvoicePrintSheet
          invoice={invoice}
          settings={settings}
          format={printFormat}
          qrDataUrl={qrDataUrl}
        />
      ) : null}
    </>
  );
}
