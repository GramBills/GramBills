import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BadgeCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { db } from '../../db/database';
import type { Invoice, InvoiceStatus } from '../../types/pos';
import { formatDateTime } from '../../lib/date';
import { formatINR, formatINR0 } from '../../lib/money';
import { getWarrantyInfo } from '../../lib/warranty';
import { invoiceMatchesSearch } from '../../services/invoices';
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
import { InvoiceDetailModal } from './InvoiceDetailModal';

type StatusFilter = 'all' | InvoiceStatus;

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

function invoiceWarrantySummary(invoice: Invoice): {
  active: number;
  expiring: number;
  expired: number;
} {
  if (invoice.status !== 'completed') {
    return { active: 0, expiring: 0, expired: 0 };
  }
  return invoice.items.reduce(
    (summary, item) => {
      const warranty = getWarrantyInfo(item.warrantyExpiryDate);
      if (warranty.status === 'active') {
        summary.active += 1;
      } else if (warranty.status === 'expiring_soon') {
        summary.expiring += 1;
      } else if (warranty.status === 'expired') {
        summary.expired += 1;
      }
      return summary;
    },
    { active: 0, expiring: 0, expired: 0 },
  );
}

export function InvoicesWarrantyView() {
  const settings = useSettings();
  const invoices = useLiveQuery(async () => {
    const rows = await db.invoices.toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, []);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const allInvoices = useMemo(() => invoices ?? [], [invoices]);

  const stats = useMemo(() => {
    let activeWarranties = 0;
    let expiringWarranties = 0;
    let reversed = 0;
    for (const invoice of allInvoices) {
      if (invoice.status !== 'completed') {
        reversed += 1;
      }
      const summary = invoiceWarrantySummary(invoice);
      activeWarranties += summary.active;
      expiringWarranties += summary.expiring;
    }
    return { activeWarranties, expiringWarranties, reversed };
  }, [allInvoices]);

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) {
        return false;
      }
      return invoiceMatchesSearch(invoice, search);
    });
  }, [allInvoices, search, statusFilter]);

  const selectedInvoice =
    allInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Phase 4"
        title="Past Bills & Warranty Lookup"
        description="Search any bill by invoice number, customer phone/name, product or serial/IMEI. Check warranty status, reprint, share on WhatsApp, or reverse a bill."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total bills"
          value={String(allInvoices.length)}
          detail="All saved invoices and estimates"
          icon={ReceiptText}
          tone="sky"
        />
        <StatCard
          label="Active warranties"
          value={String(stats.activeWarranties)}
          detail="More than 30 days remaining"
          icon={ShieldCheck}
          tone="emerald"
        />
        <StatCard
          label="Expiring soon"
          value={String(stats.expiringWarranties)}
          detail="Within the next 30 days"
          icon={TriangleAlert}
          tone="amber"
        />
        <StatCard
          label="Cancelled / returned"
          value={String(stats.reversed)}
          detail="Stock and udhaar reversed"
          icon={BadgeCheck}
          tone="rose"
        />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1.8fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search invoice no., phone, name, product, barcode or serial/IMEI"
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            aria-label="Filter by bill status"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="returned">Returned</option>
          </Select>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filteredInvoices.length} of {allInvoices.length} bills. Serial
          and IMEI search is useful for warranty checks.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Bill history
            </h2>
            <p className="text-sm text-slate-500">
              Open any bill for warranty details and reprint options.
            </p>
          </div>
          <Badge variant="info">{filteredInvoices.length} shown</Badge>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ReceiptText className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              No bills match this search
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try an invoice number, customer phone, product name or serial
              number.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Bill</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold">Warranty</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => {
                  const warranty = invoiceWarrantySummary(invoice);
                  return (
                    <tr
                      key={invoice.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => setSelectedInvoiceId(invoice.id)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(invoice.createdAt)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {invoice.items.length} item
                          {invoice.items.length === 1 ? '' : 's'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">
                          {invoice.customerName.trim() || 'Walk-in'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {invoice.customerPhone || 'No phone'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {warranty.active > 0 ? (
                            <Badge variant="success">
                              {warranty.active} active
                            </Badge>
                          ) : null}
                          {warranty.expiring > 0 ? (
                            <Badge variant="warning">
                              {warranty.expiring} expiring
                            </Badge>
                          ) : null}
                          {warranty.expired > 0 ? (
                            <Badge variant="danger">
                              {warranty.expired} expired
                            </Badge>
                          ) : null}
                          {warranty.active +
                            warranty.expiring +
                            warranty.expired ===
                          0 ? (
                            <span className="text-xs text-slate-400">
                              No warranty
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {formatINR(invoice.grandTotal)}
                        <p className="text-[11px] font-normal text-slate-500">
                          {invoice.paymentMode}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant(invoice)}>
                          {statusLabel(invoice)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedInvoiceId(invoice.id);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Warranty value in history
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatINR0(
              allInvoices.reduce(
                (total, invoice) =>
                  invoice.status === 'completed'
                    ? total +
                      invoice.items.reduce(
                        (sum, item) =>
                          item.warrantyExpiryDate ? sum + item.lineTotal : sum,
                        0,
                      )
                    : total,
                0,
              ),
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Completed-bill item value covered by a warranty date.
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lookup tip
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Scan or type the product serial/IMEI in the search box. Open the
            matching bill to see the exact warranty expiry and reprint the
            original invoice.
          </p>
        </Card>
      </div>

      {settings && selectedInvoice ? (
        <InvoiceDetailModal
          open={Boolean(selectedInvoice)}
          invoice={selectedInvoice}
          settings={settings}
          onClose={() => setSelectedInvoiceId(null)}
          onChanged={(message) => setToast({ tone: 'success', message })}
        />
      ) : null}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
