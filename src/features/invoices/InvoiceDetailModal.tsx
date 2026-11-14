import { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Printer,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import type { Invoice, ShopSettings } from '../../types/pos';
import { formatDate, formatDateTime } from '../../lib/date';
import { formatINR } from '../../lib/money';
import { getWarrantyInfo } from '../../lib/warranty';
import {
  buildReceiptMessage,
  buildWhatsAppUrl,
} from '../../lib/whatsapp';
import {
  reverseInvoice,
  type InvoiceReverseMode,
} from '../../services/invoices';
import {
  Badge,
  Button,
  Field,
  Modal,
  Select,
  Textarea,
} from '../../components/ui/primitives';
import {
  InvoicePrintSheet,
  type InvoicePrintFormat,
} from '../../components/PrintSheets';
import { UpiQr } from '../pos/UpiQr';
import { useUpiQrDataUrl } from '../pos/useUpiQrDataUrl';

interface InvoiceDetailModalProps {
  open: boolean;
  invoice: Invoice;
  settings: ShopSettings;
  onClose: () => void;
  onChanged: (message: string) => void;
}

function statusLabel(invoice: Invoice): string {
  if (invoice.status === 'cancelled') {
    return 'Cancelled';
  }
  if (invoice.status === 'returned') {
    return 'Returned';
  }
  return 'Completed';
}

function statusVariant(
  invoice: Invoice,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (invoice.status === 'cancelled') {
    return 'danger';
  }
  if (invoice.status === 'returned') {
    return 'warning';
  }
  return 'success';
}

function warrantyVariant(
  status: ReturnType<typeof getWarrantyInfo>['status'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'expiring_soon') {
    return 'warning';
  }
  if (status === 'expired') {
    return 'danger';
  }
  return 'neutral';
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
  return parts.join(' · ') || 'Unpaid';
}

export function InvoiceDetailModal({
  open,
  invoice,
  settings,
  onClose,
  onChanged,
}: InvoiceDetailModalProps) {
  const [printFormat, setPrintFormat] =
    useState<InvoicePrintFormat | null>(null);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseMode, setReverseMode] =
    useState<InvoiceReverseMode>('cancelled');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const printTimerRef = useRef<number | null>(null);
  const qrDataUrl = useUpiQrDataUrl(
    settings,
    invoice.status === 'completed' ? invoice.upiPaid : 0,
    `Bill ${invoice.invoiceNumber}`,
  );

  useEffect(() => {
    if (!open) {
      setPrintFormat(null);
      setReverseOpen(false);
      setNotice(null);
      setError(null);
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
    const url = buildWhatsAppUrl(
      invoice.customerPhone,
      buildReceiptMessage(invoice, settings),
    );
    if (!url) {
      setNotice('Add the customer phone number to share this bill on WhatsApp.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleReverse() {
    setBusy(true);
    setError(null);
    try {
      const result = await reverseInvoice({
        invoiceId: invoice.id,
        mode: reverseMode,
        reason,
      });
      setReverseOpen(false);
      setReason('');
      onChanged(
        `Bill ${result.invoice.invoiceNumber} marked as ${statusLabel(
          result.invoice,
        ).toLowerCase()}. Stock and udhaar were reversed.`,
      );
    } catch (reverseError) {
      setError(
        reverseError instanceof Error
          ? reverseError.message
          : 'Could not reverse this bill.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={`Bill ${invoice.invoiceNumber}`}
        description={`${formatDateTime(invoice.createdAt)} · ${formatINR(
          invoice.grandTotal,
        )}`}
        onClose={onClose}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => handlePrint('a4')}>
              <Printer className="h-4 w-4" />
              Print A4
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
              WhatsApp
            </Button>
            {invoice.status === 'completed' ? (
              <Button
                variant="danger"
                onClick={() => {
                  setError(null);
                  setReverseOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Cancel / return
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-5">
          {notice ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {notice}
            </p>
          ) : null}

          {invoice.status !== 'completed' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-700" />
                <p className="text-sm font-semibold text-amber-900">
                  This bill is {statusLabel(invoice).toLowerCase()}.
                </p>
              </div>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                {formatDateTime(invoice.reversedAt)} · Stock and udhaar were
                reversed once.
                {invoice.statusReason ? ` Reason: ${invoice.statusReason}` : ''}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bill status
                </p>
                <Badge variant={statusVariant(invoice)}>
                  {statusLabel(invoice)}
                </Badge>
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {invoice.invoiceNumber}
              </p>
              <p className="text-xs text-slate-500">
                {invoice.invoiceType === 'gst_tax_invoice'
                  ? 'GST tax invoice'
                  : 'Non-GST estimate'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Payment: {paymentSummary(invoice)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {invoice.customerName.trim() || 'Walk-in customer'}
              </p>
              <p className="text-xs text-slate-500">
                {invoice.customerPhone || 'No phone saved'}
              </p>
              {invoice.customerVillage ? (
                <p className="text-xs text-slate-500">
                  {invoice.customerVillage}
                </p>
              ) : null}
              {invoice.customerGstin ? (
                <p className="text-xs text-slate-500">
                  GSTIN: {invoice.customerGstin}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Items & warranty
              </h3>
              <span className="text-xs text-slate-500">
                {invoice.items.length} item
                {invoice.items.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {invoice.items.map((item) => {
                const warranty =
                  invoice.status === 'completed'
                    ? getWarrantyInfo(item.warrantyExpiryDate)
                    : {
                        status: 'not_covered' as const,
                        daysRemaining: null,
                        label: 'Warranty closed',
                      };
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} {item.unit} ×{' '}
                        {formatINR(item.unitPrice)}
                        {item.barcode ? ` · ${item.barcode}` : ''}
                      </p>
                      {item.serialOrImeiNumbers.length > 0 ? (
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {item.serialOrImeiNumbers.join(', ')}
                        </p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant={warrantyVariant(warranty.status)}>
                          {warranty.label}
                        </Badge>
                        {item.warrantyExpiryDate ? (
                          <span className="text-[11px] text-slate-500">
                            Till {formatDate(item.warrantyExpiryDate)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-900">
                      {formatINR(item.lineTotal)}
                    </p>
                  </div>
                );
              })}
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
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Tax</span>
                <span>
                  {formatINR(invoice.cgstTotal + invoice.sgstTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatINR(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Payment</p>
              <p className="mt-1 text-xs text-slate-500">
                {paymentSummary(invoice)}
              </p>
              {invoice.upiReferenceNote ? (
                <p className="text-xs text-slate-500">
                  UPI reference: {invoice.upiReferenceNote}
                </p>
              ) : null}
              {invoice.notes ? (
                <p className="text-xs text-slate-500">Note: {invoice.notes}</p>
              ) : null}
            </div>
            {qrDataUrl ? (
              <UpiQr
                settings={settings}
                amount={invoice.upiPaid}
                note={`Bill ${invoice.invoiceNumber}`}
                size={108}
              />
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={reverseOpen}
        title="Cancel or return this bill"
        description={`${invoice.invoiceNumber} · ${formatINR(
          invoice.grandTotal,
        )}`}
        onClose={busy ? () => undefined : () => setReverseOpen(false)}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setReverseOpen(false)}
              disabled={busy}
            >
              Keep bill
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleReverse()}
              disabled={busy}
            >
              {busy ? 'Reversing...' : 'Confirm reversal'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            This restores every item to stock and reverses the udhaar amount
            once. Cash/UPI refunds must be handled manually.
          </div>

          <Field label="Action" htmlFor="invoice-reverse-mode">
            <Select
              id="invoice-reverse-mode"
              value={reverseMode}
              onChange={(event) =>
                setReverseMode(event.target.value as InvoiceReverseMode)
              }
            >
              <option value="cancelled">Cancel bill</option>
              <option value="returned">Customer return</option>
            </Select>
          </Field>

          <Field
            label="Reason"
            htmlFor="invoice-reverse-reason"
            hint="Optional"
          >
            <Textarea
              id="invoice-reverse-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Customer changed mind, defective item, etc."
            />
          </Field>
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
