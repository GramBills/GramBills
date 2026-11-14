import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownToLine,
  CalendarDays,
  HandCoins,
  Landmark,
  PackageSearch,
  Percent,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { db } from '../../db/database';
import type { ReportRangeKey } from '../../lib/reports';
import {
  buildReportSummary,
  getCustomReportRange,
  getReportRange,
} from '../../lib/reports';
import { formatDate } from '../../lib/date';
import { formatINR, formatINR0 } from '../../lib/money';
import { toCsv } from '../../lib/csv';
import { downloadCsv } from '../../lib/download';
import { cn } from '../../lib/cn';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  StatCard,
} from '../../components/ui/primitives';

const RANGE_OPTIONS: Array<{
  key: Exclude<ReportRangeKey, 'custom'>;
  label: string;
}> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
];

function toDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ReportsDashboardView() {
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const khataTransactions = useLiveQuery(
    () => db.khataTransactions.toArray(),
    [],
  );
  const products = useLiveQuery(
    async () => {
      const rows = await db.products.toArray();
      return rows.filter((product) => !product.deletedAt);
    },
    [],
  );

  const today = useMemo(() => new Date(), []);
  const [rangeKey, setRangeKey] = useState<ReportRangeKey>('today');
  const [customStart, setCustomStart] = useState(toDateInput(today));
  const [customEnd, setCustomEnd] = useState(toDateInput(today));

  const { range, rangeError } = useMemo(() => {
    try {
      if (rangeKey === 'custom') {
        return {
          range: getCustomReportRange(customStart, customEnd),
          rangeError: null,
        };
      }
      return { range: getReportRange(rangeKey), rangeError: null };
    } catch (error) {
      return {
        range: null,
        rangeError:
          error instanceof Error
            ? error.message
            : 'Choose a valid date range.',
      };
    }
  }, [customEnd, customStart, rangeKey]);

  const summary = useMemo(() => {
    if (!range) {
      return null;
    }
    return buildReportSummary(
      invoices ?? [],
      khataTransactions ?? [],
      products ?? [],
      range,
    );
  }, [invoices, khataTransactions, products, range]);

  function handleDownloadReorder() {
    if (!summary || summary.lowStock.length === 0) {
      return;
    }
    const csv = toCsv([
      [
        'product_id',
        'name',
        'category',
        'brand',
        'unit',
        'stock_qty',
        'low_stock_threshold',
        'suggested_reorder_qty',
      ],
      ...summary.lowStock.map((row) => [
        row.productId,
        row.name,
        row.category,
        row.brand,
        row.unit,
        row.stockQty,
        row.threshold,
        row.suggestedQty,
      ]),
    ]);
    const start = range ? toDateInput(range.start) : customStart;
    const end = range ? toDateInput(range.end) : customEnd;
    downloadCsv(
      `grambill-reorder-${start === end ? start : `${start}-to-${end}`}.csv`,
      csv,
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Phase 4"
        title="Reports & Daily Closing"
        description="See galla cash, UPI/bank collections, udhaar movement, net profit and a ready low-stock reorder list. Completed bills only; cancelled and returned bills are excluded from sales."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Report range
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.key}
                  size="sm"
                  variant={rangeKey === option.key ? 'primary' : 'secondary'}
                  aria-pressed={rangeKey === option.key}
                  onClick={() => setRangeKey(option.key)}
                >
                  {option.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant={rangeKey === 'custom' ? 'primary' : 'secondary'}
                aria-pressed={rangeKey === 'custom'}
                onClick={() => setRangeKey('custom')}
              >
                Custom
              </Button>
            </div>
          </div>

          {rangeKey === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From" htmlFor="report-start-date">
                <Input
                  id="report-start-date"
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
              </Field>
              <Field label="To" htmlFor="report-end-date">
                <Input
                  id="report-end-date"
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              {range ? (
                <>
                  <span className="font-semibold text-slate-700">
                    {range.label}
                  </span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  {formatDate(range.start)} to {formatDate(range.end)}
                </>
              ) : null}
            </div>
          )}
        </div>
        {rangeError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {rangeError}
          </p>
        ) : null}
      </Card>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sales"
              value={formatINR0(summary.salesTotal)}
              detail={`${summary.invoiceCount} completed bill${
                summary.invoiceCount === 1 ? '' : 's'
              }`}
              icon={TrendingUp}
              tone="sky"
            />
            <StatCard
              label="Net profit"
              value={formatINR0(summary.netProfit)}
              detail={`${summary.marginPercent.toFixed(1)}% margin after tax`}
              icon={Percent}
              tone="emerald"
            />
            <StatCard
              label="Cash in drawer"
              value={formatINR0(summary.cashCollected)}
              detail="Bill cash + khata cash received"
              icon={Wallet}
              tone="amber"
            />
            <StatCard
              label="UPI / bank"
              value={formatINR0(summary.upiCollected)}
              detail="Bill UPI + khata UPI received"
              icon={Landmark}
              tone="sky"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="New udhaar"
              value={formatINR0(summary.newUdhaar)}
              detail="Credit given on completed bills"
              icon={HandCoins}
              tone="rose"
            />
            <StatCard
              label="Udhaar collected"
              value={formatINR0(summary.udhaarCollected)}
              detail="Old khata payments received"
              icon={ArrowDownToLine}
              tone="emerald"
            />
            <StatCard
              label="Average bill"
              value={formatINR0(summary.averageBill)}
              detail="Completed bills only"
              icon={ReceiptText}
              tone="sky"
            />
            <StatCard
              label="Cancelled / returned"
              value={String(summary.cancelledCount)}
              detail="Excluded from sales and profit"
              icon={PackageSearch}
              tone="rose"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Galla closing
                  </h2>
                  <p className="text-sm text-slate-500">{range?.label}</p>
                </div>
                <Badge variant="info">Cash + digital</Badge>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Cash collected
                    </p>
                    <p className="text-xs text-slate-500">
                      Bills {formatINR(summary.invoiceCash)} · Khata{' '}
                      {formatINR(summary.khataCash)}
                    </p>
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {formatINR(summary.cashCollected)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      UPI / bank collected
                    </p>
                    <p className="text-xs text-slate-500">
                      Bills {formatINR(summary.invoiceUpi)} · Khata{' '}
                      {formatINR(summary.khataUpi)}
                    </p>
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {formatINR(summary.upiCollected)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Card collected
                    </p>
                    <p className="text-xs text-slate-500">
                      Card payments on bills
                    </p>
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {formatINR(summary.cardCollected)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 bg-slate-50 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Total collected
                    </p>
                    <p className="text-xs text-slate-500">
                      Cash + UPI + card
                    </p>
                  </div>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatINR(
                      summary.cashCollected +
                        summary.upiCollected +
                        summary.cardCollected,
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-t border-slate-200 px-5 py-4 text-center">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tax
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatINR0(summary.taxTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Profit
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    {formatINR0(summary.netProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Margin
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {summary.marginPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Top selling products
                  </h2>
                  <p className="text-sm text-slate-500">
                    By revenue in this range
                  </p>
                </div>
                <Badge variant="success">Top 5</Badge>
              </div>
              {summary.topProducts.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <TrendingUp className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No completed sales in this range
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Change the date range or complete a bill in POS.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {summary.topProducts.map((product, index) => (
                    <div
                      key={product.productId}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          index === 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {product.productName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.quantity} sold · Profit{' '}
                          {formatINR(product.profit)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-slate-900">
                        {formatINR(product.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Low-stock reorder list
                </h2>
                <p className="text-sm text-slate-500">
                  Items at or below threshold. Suggested quantity is enough to
                  reach roughly twice the threshold.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadReorder}
                disabled={summary.lowStock.length === 0}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Download CSV
              </Button>
            </div>

            {summary.lowStock.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <PackageSearch className="mx-auto h-9 w-9 text-emerald-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  Stock levels look healthy
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  No product is at or below its low-stock threshold.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Product</th>
                      <th className="px-5 py-3 font-semibold">Category</th>
                      <th className="px-5 py-3 font-semibold">Rack</th>
                      <th className="px-5 py-3 text-right font-semibold">
                        In stock
                      </th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Threshold
                      </th>
                      <th className="px-5 py-3 text-right font-semibold">
                        Suggested reorder
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.lowStock.map((row) => (
                      <tr key={row.productId}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">
                            {row.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.brand || 'No brand'} · {row.unit}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {row.category}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {products?.find(
                            (product) => product.id === row.productId,
                          )?.rackLocation || '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Badge
                            variant={row.stockQty === 0 ? 'danger' : 'warning'}
                          >
                            {row.stockQty}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {row.threshold}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {row.suggestedQty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            Net profit = bill total − GST − cost price of items sold. It does not
            deduct shop rent, salary, electricity or other expenses. Cash/UPI
            refunds for cancelled or returned bills must be tracked manually.
          </p>
        </>
      ) : null}
    </div>
  );
}
