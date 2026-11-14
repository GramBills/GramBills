import { useEffect, useState } from 'react';
import { Banknote, Loader2 } from 'lucide-react';
import type { Customer } from '../../types/pos';
import { formatINR } from '../../lib/money';
import { recordKhataPayment } from '../../services/khata';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '../../components/ui/primitives';

interface RecordPaymentModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function RecordPaymentModal({
  open,
  customer,
  onClose,
  onSaved,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customer) {
      return;
    }
    setAmount(String(customer.currentUdhaarBalance));
    setPaymentMode('cash');
    setRemarks('');
    setError(null);
    setBusy(false);
  }, [open, customer]);

  async function handleSave() {
    if (!customer) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await recordKhataPayment({
        customerId: customer.id,
        amount: Number(amount),
        paymentMode,
        remarks,
      });
      onSaved(
        `Payment of ${formatINR(result.transaction.amount)} saved for ${
          result.customer.name
        }. New balance ${formatINR(result.customer.currentUdhaarBalance)}.`,
      );
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not record this payment.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Record khata payment"
      description={
        customer
          ? `${customer.name} · Outstanding ${formatINR(
              customer.currentUdhaarBalance,
            )}`
          : undefined
      }
      onClose={busy ? () => undefined : onClose}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || !customer}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}
            {busy ? 'Saving...' : 'Save payment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <Field
          label="Amount received"
          htmlFor="khata-payment-amount"
          hint={customer ? `Max ${formatINR(customer.currentUdhaarBalance)}` : undefined}
        >
          <Input
            id="khata-payment-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Payment mode" htmlFor="khata-payment-mode">
          <Select
            id="khata-payment-mode"
            value={paymentMode}
            onChange={(event) =>
              setPaymentMode(event.target.value as 'cash' | 'upi')
            }
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
          </Select>
        </Field>

        <Field label="Remarks" htmlFor="khata-payment-remarks" hint="Optional">
          <Textarea
            id="khata-payment-remarks"
            rows={2}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Collected at shop, market day, etc."
          />
        </Field>
      </div>
    </Modal>
  );
}
