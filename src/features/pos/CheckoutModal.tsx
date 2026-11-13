import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  BookUser,
  CreditCard,
  Loader2,
  Smartphone,
  Split,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type {
  InvoiceType,
  PaymentMode,
  ShopSettings,
} from '../../types/pos';
import type {
  CheckoutCustomerInput,
  CheckoutPaymentInput,
  CheckoutResult,
} from '../../services/invoices';
import { createInvoice } from '../../services/invoices';
import { formatINR, round2 } from '../../lib/money';
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Textarea,
} from '../../components/ui/primitives';
import { cn } from '../../lib/cn';
import {
  isBelowFloorPrice,
  toCheckoutLine,
  type CartLine,
} from './cart';
import type { GstInvoiceTotals } from '../../lib/gst';
import { CustomerPicker } from './CustomerPicker';
import { UpiQr } from './UpiQr';

interface CheckoutModalProps {
  open: boolean;
  settings: ShopSettings;
  lines: CartLine[];
  totals: GstInvoiceTotals;
  extraBillDiscount: number;
  invoiceType: InvoiceType;
  customer: CheckoutCustomerInput | null;
  onCustomerChange: (customer: CheckoutCustomerInput | null) => void;
  onClose: () => void;
  onCompleted: (result: CheckoutResult) => void;
}

const PAYMENT_MODES: {
  value: PaymentMode;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'split', label: 'Split', icon: Split },
  { value: 'udhaar', label: 'Udhaar', icon: BookUser },
];

function amountFromInput(value: string): number {
  if (value.trim() === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function CheckoutModal({
  open,
  settings,
  lines,
  totals,
  extraBillDiscount,
  invoiceType,
  customer,
  onCustomerChange,
  onClose,
  onCompleted,
}: CheckoutModalProps) {
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [upiReferenceNote, setUpiReferenceNote] = useState('');
  const [notes, setNotes] = useState('');
  const [allowBelowFloor, setAllowBelowFloor] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = totals.grandTotal;
  const belowFloorLines = useMemo(
    () => lines.filter(isBelowFloorPrice),
    [lines],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode('cash');
    setCashTendered(String(total));
    setSplitCash('');
    setSplitUpi('');
    setSplitCard('');
    setUpiReferenceNote('');
    setNotes('');
    setAllowBelowFloor(false);
    setError(null);
    setBusy(false);
  }, [open, total]);

  const cashValue = amountFromInput(cashTendered);
  const splitCashValue = amountFromInput(splitCash);
  const splitUpiValue = amountFromInput(splitUpi);
  const splitCardValue = amountFromInput(splitCard);
  const splitPaid = round2(
    splitCashValue + splitUpiValue + splitCardValue,
  );
  const splitUdhaar = round2(Math.max(0, total - splitPaid));

  const paymentError = useMemo(() => {
    if (mode === 'cash' && cashValue < total) {
      return `Cash received is ${formatINR(cashValue)}. Collect at least ${formatINR(total)}.`;
    }
    if (mode === 'split' && splitPaid > total) {
      return `Split payment exceeds the bill total by ${formatINR(splitPaid - total)}.`;
    }
    if (
      (mode === 'udhaar' || (mode === 'split' && splitUdhaar > 0)) &&
      (!customer || !customer.phone.trim())
    ) {
      return 'Select a customer with a phone number for an udhaar bill.';
    }
    if (belowFloorLines.length > 0 && !allowBelowFloor) {
      return 'Confirm the below-floor price override before checkout.';
    }
    return null;
  }, [
    allowBelowFloor,
    belowFloorLines.length,
    cashValue,
    customer,
    mode,
    splitPaid,
    splitUdhaar,
    total,
  ]);

  const cashApplied =
    mode === 'cash' ? total : mode === 'split' ? splitCashValue : 0;
  const upiApplied =
    mode === 'upi' ? total : mode === 'split' ? splitUpiValue : 0;
  const cardApplied =
    mode === 'card' ? total : mode === 'split' ? splitCardValue : 0;
  const udhaarApplied =
    mode === 'udhaar' ? total : mode === 'split' ? splitUdhaar : 0;
  const change = mode === 'cash' ? round2(Math.max(0, cashValue - total)) : 0;
  const paidTotal = round2(cashApplied + upiApplied + cardApplied);

  function buildPayment(): CheckoutPaymentInput {
    return {
      mode,
      cashPaid: cashApplied,
      upiPaid: upiApplied,
      cardPaid: cardApplied,
      udhaarAmount: udhaarApplied,
      upiReferenceNote,
      notes,
    };
  }

  async function handleConfirm() {
    if (paymentError) {
      setError(paymentError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createInvoice({
        invoiceType,
        customer,
        items: lines.map(toCheckoutLine),
        extraBillDiscount,
        payment: buildPayment(),
        allowBelowFloor,
      });
      onCompleted(result);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Could not complete checkout.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        title="Checkout"
        description={`${lines.length} item${
          lines.length === 1 ? '' : 's'
        } · ${formatINR(total)}`}
        onClose={busy ? () => undefined : onClose}
        size="xl"
        footer={
          <>
            <div className="mr-auto hidden text-sm text-slate-500 sm:block">
              {paidTotal > 0 ? `Paid ${formatINR(paidTotal)}` : 'No payment yet'}
              {udhaarApplied > 0
                ? ` · Udhaar ${formatINR(udhaarApplied)}`
                : ''}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy || Boolean(paymentError)}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4" />
              )}
              {busy ? 'Saving bill...' : `Complete bill · ${formatINR(total)}`}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {error ? (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  Customer
                </h3>
                {customer ? (
                  <p className="mt-1 text-sm text-slate-700">
                    {customer.name} · {customer.phone}
                    {customer.villageOrArea
                      ? ` · ${customer.villageOrArea}`
                      : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Walk-in customer. Add a customer for udhaar or warranty
                    messages.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCustomerPickerOpen(true)}
                >
                  {customer ? 'Change' : 'Select customer'}
                </Button>
                {customer ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCustomerChange(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">
              Payment method
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PAYMENT_MODES.map((option) => {
                const Icon = option.icon;
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setMode(option.value);
                      setError(null);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition',
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="h-5 w-5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {mode === 'cash' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Cash received" htmlFor="cash-received">
                    <Input
                      id="cash-received"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashTendered}
                      onChange={(event) =>
                        setCashTendered(event.target.value)
                      }
                      autoFocus
                    />
                  </Field>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Change to return
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {formatINR(change)}
                    </p>
                  </div>
                </div>
              ) : null}

              {mode === 'upi' ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <UpiQr
                      settings={settings}
                      amount={total}
                      note={`Bill ${invoiceType === 'gst_tax_invoice' ? 'GST' : 'estimate'}`}
                      size={170}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Scan to pay {formatINR(total)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        This is a payment request. Confirm the UPI app success
                        message before completing the bill.
                      </p>
                      {!settings.upiId ? (
                        <Badge variant="warning" className="mt-2">
                          Add UPI ID in Shop Settings
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Field
                    label="UPI reference / last 4 digits"
                    htmlFor="upi-reference"
                    className="mt-4"
                    hint="Optional"
                  >
                    <Input
                      id="upi-reference"
                      value={upiReferenceNote}
                      onChange={(event) =>
                        setUpiReferenceNote(event.target.value)
                      }
                      placeholder="e.g. 4821"
                    />
                  </Field>
                </div>
              ) : null}

              {mode === 'card' ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Card payment of{' '}
                  <span className="font-semibold text-slate-900">
                    {formatINR(total)}
                  </span>{' '}
                  will be recorded. Confirm the card machine success message.
                </div>
              ) : null}

              {mode === 'split' ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Cash" htmlFor="split-cash">
                      <Input
                        id="split-cash"
                        type="number"
                        min="0"
                        step="0.01"
                        value={splitCash}
                        onChange={(event) => setSplitCash(event.target.value)}
                      />
                    </Field>
                    <Field label="UPI" htmlFor="split-upi">
                      <Input
                        id="split-upi"
                        type="number"
                        min="0"
                        step="0.01"
                        value={splitUpi}
                        onChange={(event) => setSplitUpi(event.target.value)}
                      />
                    </Field>
                    <Field label="Card" htmlFor="split-card">
                      <Input
                        id="split-card"
                        type="number"
                        min="0"
                        step="0.01"
                        value={splitCard}
                        onChange={(event) => setSplitCard(event.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-600">Remaining as udhaar</span>
                    <span className="font-bold text-slate-900">
                      {formatINR(splitUdhaar)}
                    </span>
                  </div>
                  {splitUpiValue > 0 ? (
                    <div className="flex items-center gap-4">
                      <UpiQr
                        settings={settings}
                        amount={splitUpiValue}
                        note="Split UPI payment"
                        size={140}
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        Scan for the UPI part only.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === 'udhaar' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <BookUser className="h-4 w-4" />
                    Full udhaar bill
                  </p>
                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    {formatINR(total)} will be added to the selected customer's
                    khata. Select a customer with a phone number.
                  </p>
                </div>
              ) : null}

              {belowFloorLines.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <TriangleAlert className="h-4 w-4" />
                    Below-floor price warning
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-800">
                    {belowFloorLines.map((line) => (
                      <li key={line.id}>
                        {line.name}: {formatINR(line.unitPrice)} is below floor{' '}
                        {formatINR(line.minSellingPrice)}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-start gap-2 text-xs font-medium text-amber-900">
                    <input
                      type="checkbox"
                      checked={allowBelowFloor}
                      onChange={(event) =>
                        setAllowBelowFloor(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    I understand and approve this below-floor price.
                  </label>
                </div>
              ) : null}

              <Field label="Bill notes" htmlFor="bill-notes" hint="Optional">
                <Textarea
                  id="bill-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Delivery, installation, or warranty note"
                />
              </Field>
            </div>

            <aside className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Bill summary
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd className="font-medium text-slate-800">
                    {formatINR(totals.subtotal)}
                  </dd>
                </div>
                {totals.itemDiscountTotal + totals.extraBillDiscount > 0 ? (
                  <div className="flex justify-between gap-2 text-emerald-700">
                    <dt>Discount</dt>
                    <dd className="font-medium">
                      -{formatINR(
                        totals.itemDiscountTotal + totals.extraBillDiscount,
                      )}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Tax</dt>
                  <dd className="font-medium text-slate-800">
                    {formatINR(totals.taxAmount)}
                  </dd>
                </div>
                {totals.roundOff !== 0 ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Round off</dt>
                    <dd className="font-medium text-slate-800">
                      {formatINR(totals.roundOff)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2 border-t border-slate-200 pt-2 text-base">
                  <dt className="font-semibold text-slate-900">Total</dt>
                  <dd className="font-bold text-slate-900">
                    {formatINR(total)}
                  </dd>
                </div>
              </dl>

              <div className="space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500">
                <p>Paid: {formatINR(paidTotal)}</p>
                <p>Udhaar: {formatINR(udhaarApplied)}</p>
                {mode === 'cash' ? <p>Change: {formatINR(change)}</p> : null}
              </div>

              {paymentError ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {paymentError}
                </p>
              ) : null}
            </aside>
          </div>
        </div>
      </Modal>

      <CustomerPicker
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(selected) =>
          onCustomerChange({
            id: selected.id,
            name: selected.name,
            phone: selected.phone,
            villageOrArea: selected.villageOrArea,
            gstin: selected.gstin,
          })
        }
      />
    </>
  );
}
