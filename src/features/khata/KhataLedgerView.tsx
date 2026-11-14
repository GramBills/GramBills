import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookUser,
  CheckCircle2,
  MessageCircle,
  Search,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { db } from '../../db/database';
import type { Customer, KhataTransaction } from '../../types/pos';
import { formatDate } from '../../lib/date';
import { formatINR, formatINR0 } from '../../lib/money';
import {
  buildKhataReminderMessage,
  buildWhatsAppUrl,
} from '../../lib/whatsapp';
import { calculateKhataBalance } from '../../services/khata';
import { useSettings } from '../../hooks/useSettings';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  StatCard,
  Toast,
  type ToastMessage,
} from '../../components/ui/primitives';
import { cn } from '../../lib/cn';
import { RecordPaymentModal } from './RecordPaymentModal';

type BalanceFilter = 'all' | 'outstanding' | 'over_limit';

function isToday(value: string): boolean {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function transactionLabel(transaction: KhataTransaction): string {
  if (transaction.type === 'credit_given') {
    return transaction.invoiceId ? 'Credit given' : 'Opening balance';
  }
  if (transaction.type === 'payment_received') {
    return transaction.paymentMode === 'upi'
      ? 'UPI payment received'
      : 'Cash payment received';
  }
  return 'Credit reversed';
}

function transactionAmountClass(transaction: KhataTransaction): string {
  if (transaction.type === 'credit_given') {
    return 'text-rose-600';
  }
  if (transaction.type === 'credit_reversed') {
    return 'text-amber-700';
  }
  return 'text-emerald-700';
}

function transactionAmount(transaction: KhataTransaction): string {
  if (transaction.type === 'credit_given') {
    return `+${formatINR(transaction.amount)}`;
  }
  return `-${formatINR(transaction.amount)}`;
}

export function KhataLedgerView() {
  const settings = useSettings();
  const customers = useLiveQuery(async () => {
    const rows = await db.customers.toArray();
    return rows
      .filter((customer) => !customer.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const transactions = useLiveQuery(async () => {
    const rows = await db.khataTransactions.toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);

  const [search, setSearch] = useState('');
  const [village, setVillage] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const allCustomers = useMemo(() => customers ?? [], [customers]);
  const allTransactions = useMemo(() => transactions ?? [], [transactions]);

  const villages = useMemo(
    () =>
      Array.from(
        new Set(
          allCustomers.map((customer) => customer.villageOrArea).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [allCustomers],
  );

  const stats = useMemo(() => {
    const outstanding = allCustomers.reduce(
      (total, customer) =>
        total + Math.max(0, customer.currentUdhaarBalance),
      0,
    );
    const withUdhaar = allCustomers.filter(
      (customer) => customer.currentUdhaarBalance > 0,
    ).length;
    const overLimit = allCustomers.filter(
      (customer) =>
        customer.creditLimit > 0 &&
        customer.currentUdhaarBalance >= customer.creditLimit,
    ).length;
    const collectedToday = allTransactions
      .filter(
        (transaction) =>
          transaction.type === 'payment_received' &&
          isToday(transaction.createdAt),
      )
      .reduce((total, transaction) => total + transaction.amount, 0);
    return { outstanding, withUdhaar, overLimit, collectedToday };
  }, [allCustomers, allTransactions]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allCustomers.filter((customer) => {
      if (village !== 'all' && customer.villageOrArea !== village) {
        return false;
      }
      if (
        balanceFilter === 'outstanding' &&
        customer.currentUdhaarBalance <= 0
      ) {
        return false;
      }
      if (
        balanceFilter === 'over_limit' &&
        !(
          customer.creditLimit > 0 &&
          customer.currentUdhaarBalance >= customer.creditLimit
        )
      ) {
        return false;
      }
      if (term === '') {
        return true;
      }
      return [customer.name, customer.phone, customer.villageOrArea]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [allCustomers, balanceFilter, search, village]);

  const activeCustomer =
    filteredCustomers.find((customer) => customer.id === selectedId) ??
    filteredCustomers[0] ??
    null;
  const activeTransactions = useMemo(
    () =>
      activeCustomer
        ? allTransactions.filter(
            (transaction) => transaction.customerId === activeCustomer.id,
          )
        : [],
    [activeCustomer, allTransactions],
  );
  const ledgerBalance = useMemo(
    () => calculateKhataBalance(activeTransactions),
    [activeTransactions],
  );
  const ledgerMismatch =
    activeCustomer !== null &&
    Math.abs(ledgerBalance - activeCustomer.currentUdhaarBalance) > 0.01;

  function handleWhatsAppReminder(customer: Customer) {
    if (!settings) {
      setToast({ tone: 'error', message: 'Shop settings are not ready yet.' });
      return;
    }
    const url = buildWhatsAppUrl(
      customer.phone,
      buildKhataReminderMessage(customer, settings),
    );
    if (!url) {
      setToast({
        tone: 'error',
        message: 'Add a valid customer phone number for WhatsApp.',
      });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Phase 4"
        title="Customer Udhaar (Khata)"
        description="Track village-wise credit, collect payments, reconcile every balance, and send one-click WhatsApp reminders."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding udhaar"
          value={formatINR0(stats.outstanding)}
          detail={`${stats.withUdhaar} customers have a balance`}
          icon={BookUser}
          tone="rose"
        />
        <StatCard
          label="Collected today"
          value={formatINR0(stats.collectedToday)}
          detail="Cash and UPI khata payments"
          icon={Wallet}
          tone="emerald"
        />
        <StatCard
          label="Customers"
          value={String(allCustomers.length)}
          detail={`${villages.length} villages/areas`}
          icon={CheckCircle2}
          tone="sky"
        />
        <StatCard
          label="Over credit limit"
          value={String(stats.overLimit)}
          detail="Needs collection follow-up"
          icon={TriangleAlert}
          tone="amber"
        />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer name, phone or village"
              className="pl-9"
            />
          </div>
          <Select
            value={village}
            onChange={(event) => setVillage(event.target.value)}
            aria-label="Filter by village"
          >
            <option value="all">All villages/areas</option>
            {villages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            value={balanceFilter}
            onChange={(event) =>
              setBalanceFilter(event.target.value as BalanceFilter)
            }
            aria-label="Filter by balance"
          >
            <option value="all">All customers</option>
            <option value="outstanding">With udhaar</option>
            <option value="over_limit">Over credit limit</option>
          </Select>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filteredCustomers.length} of {allCustomers.length} customers.
          Opening balances are stored as passbook entries.
        </p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Customer khata
              </h2>
              <p className="text-sm text-slate-500">
                Select a customer to open the passbook.
              </p>
            </div>
            <Badge variant="info">{filteredCustomers.length} shown</Badge>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-slate-900">
                No customers match these filters.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Clear the search or choose a different balance filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Village</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Outstanding
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Credit limit
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((customer) => {
                    const overLimit =
                      customer.creditLimit > 0 &&
                      customer.currentUdhaarBalance >= customer.creditLimit;
                    const selected = activeCustomer?.id === customer.id;
                    return (
                      <tr
                        key={customer.id}
                        className={cn(
                          'cursor-pointer hover:bg-slate-50/80',
                          selected && 'bg-emerald-50/60',
                        )}
                        onClick={() => setSelectedId(customer.id)}
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">
                            {customer.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {customer.phone} · Last visit{' '}
                            {formatDate(customer.lastVisitDate)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {customer.villageOrArea || '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={cn(
                              'font-semibold',
                              customer.currentUdhaarBalance > 0
                                ? 'text-rose-600'
                                : 'text-emerald-700',
                            )}
                          >
                            {formatINR(customer.currentUdhaarBalance)}
                          </span>
                          {overLimit ? (
                            <p className="text-[11px] font-medium text-amber-700">
                              Over limit
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {customer.creditLimit > 0
                            ? formatINR(customer.creditLimit)
                            : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="WhatsApp reminder"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleWhatsAppReminder(customer);
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPaymentCustomer(customer);
                              }}
                              disabled={customer.currentUdhaarBalance <= 0}
                            >
                              Collect
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          {activeCustomer ? (
            <>
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Passbook
                    </p>
                    <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                      {activeCustomer.name}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {activeCustomer.phone}
                      {activeCustomer.villageOrArea
                        ? ` · ${activeCustomer.villageOrArea}`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Balance
                    </p>
                    <p
                      className={cn(
                        'text-2xl font-bold tracking-tight',
                        activeCustomer.currentUdhaarBalance > 0
                          ? 'text-rose-600'
                          : 'text-emerald-700',
                      )}
                    >
                      {formatINR(activeCustomer.currentUdhaarBalance)}
                    </p>
                  </div>
                </div>

                {activeCustomer.creditLimit > 0 ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] font-medium text-slate-500">
                      <span>Credit used</span>
                      <span>
                        {formatINR(activeCustomer.currentUdhaarBalance)} /{' '}
                        {formatINR(activeCustomer.creditLimit)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          activeCustomer.currentUdhaarBalance >=
                            activeCustomer.creditLimit
                            ? 'bg-rose-500'
                            : 'bg-emerald-500',
                        )}
                        style={{
                          width: `${Math.min(
                            100,
                            (activeCustomer.currentUdhaarBalance /
                              activeCustomer.creditLimit) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setPaymentCustomer(activeCustomer)}
                    disabled={activeCustomer.currentUdhaarBalance <= 0}
                  >
                    <Wallet className="h-4 w-4" />
                    Record payment
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleWhatsAppReminder(activeCustomer)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp reminder
                  </Button>
                </div>
              </div>

              {ledgerMismatch ? (
                <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                  Passbook entries total {formatINR(ledgerBalance)} but customer
                  balance is {formatINR(activeCustomer.currentUdhaarBalance)}.
                  Check for an old opening balance or manual adjustment.
                </div>
              ) : null}

              <div className="divide-y divide-slate-100">
                {activeTransactions.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <BookUser className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      No passbook entries yet
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Udhaar bills and payments will appear here.
                    </p>
                  </div>
                ) : (
                  activeTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {transactionLabel(transaction)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(transaction.createdAt)}
                          {transaction.remarks
                            ? ` · ${transaction.remarks}`
                            : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            'text-sm font-bold',
                            transactionAmountClass(transaction),
                          )}
                        >
                          {transactionAmount(transaction)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Bal {formatINR(transaction.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <BookUser className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Select a customer
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Choose a customer from the list to view their passbook.
              </p>
            </div>
          )}
        </Card>
      </div>

      <RecordPaymentModal
        open={Boolean(paymentCustomer)}
        customer={paymentCustomer}
        onClose={() => setPaymentCustomer(null)}
        onSaved={(message) => setToast({ tone: 'success', message })}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
