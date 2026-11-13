import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2, Phone, Search, UserPlus } from 'lucide-react';
import { db } from '../../db/database';
import type { Customer } from '../../types/pos';
import { formatINR0 } from '../../lib/money';
import { createCustomer } from '../../services/customers';
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
} from '../../components/ui/primitives';

interface CustomerPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
}

export function CustomerPicker({
  open,
  onClose,
  onSelect,
}: CustomerPickerProps) {
  const customers = useLiveQuery(
    () =>
      db.customers
        .toArray()
        .then((rows) =>
          rows
            .filter((customer) => !customer.deletedAt)
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
    [],
  );
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = customers ?? [];
    if (term === '') {
      return rows.slice(0, 12);
    }
    return rows
      .filter((customer) =>
        [customer.name, customer.phone, customer.villageOrArea]
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 20);
  }, [customers, search]);

  function resetForm() {
    setName('');
    setPhone('');
    setVillage('');
    setError(null);
    setShowAdd(false);
  }

  function handleClose() {
    resetForm();
    setSearch('');
    onClose();
  }

  function handleSelect(customer: Customer) {
    onSelect(customer);
    handleClose();
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const customer = await createCustomer({
        name,
        phone,
        villageOrArea: village,
      });
      onSelect(customer);
      handleClose();
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : 'Could not save the customer.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Select customer"
      description="Search an existing customer or add a new one for udhaar and warranty records."
      onClose={handleClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          {!showAdd ? (
            <Button onClick={() => setShowAdd(true)} disabled={busy}>
              <UserPlus className="h-4 w-4" />
              Add customer
            </Button>
          ) : null}
        </>
      }
    >
      {!showAdd ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, phone, or village"
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No customer found. Add a new customer to continue.
              </div>
            ) : (
              filtered.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {customer.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5" />
                      {customer.phone}
                      {customer.villageOrArea
                        ? ` · ${customer.villageOrArea}`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Udhaar
                    </p>
                    <p
                      className={
                        customer.currentUdhaarBalance > 0
                          ? 'text-sm font-bold text-rose-600'
                          : 'text-sm font-semibold text-emerald-700'
                      }
                    >
                      {formatINR0(customer.currentUdhaarBalance)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleAdd} className="space-y-4">
          {error ? (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" htmlFor="customer-name" required>
              <Input
                id="customer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ramesh Patel"
                autoFocus
              />
            </Field>
            <Field label="Phone number" htmlFor="customer-phone" required>
              <Input
                id="customer-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
              />
            </Field>
            <Field
              label="Village / area"
              htmlFor="customer-village"
              className="sm:col-span-2"
            >
              <Input
                id="customer-village"
                value={village}
                onChange={(event) => setVillage(event.target.value)}
                placeholder="Nandpur"
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">New customer starts with zero udhaar</Badge>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={busy}
            >
              Back to search
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {busy ? 'Saving...' : 'Save customer'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
