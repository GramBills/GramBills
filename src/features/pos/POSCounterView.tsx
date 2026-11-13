import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Package,
  Settings,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatINR, formatINR0 } from '../../lib/money';
import { APP_VERSION } from '../../lib/appInfo';
import type { ViewKey } from '../../app/navigation';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  StatCard,
} from '../../components/ui/primitives';

interface POSCounterViewProps {
  onNavigate: (view: ViewKey) => void;
}

export function POSCounterView({ onNavigate }: POSCounterViewProps) {
  const stats = useLiveQuery(async () => {
    const [products, customers, invoiceCount] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.invoices.count(),
    ]);
    return {
      productCount: products.length,
      customerCount: customers.length,
      lowStockCount: products.filter(
        (product) => product.stockQty <= product.lowStockThreshold,
      ).length,
      invoiceCount,
      udhaarTotal: customers.reduce(
        (total, customer) =>
          total + Math.max(0, customer.currentUdhaarBalance),
        0,
      ),
      sampleProducts: products.slice(0, 5),
    };
  }, []);

  const readiness = [
    { label: 'Local database initialized', done: true },
    { label: '15 sample products seeded', done: true },
    { label: '4 sample rural customers seeded', done: true },
    { label: 'Shop settings saved on this laptop', done: true },
    { label: 'JSON backup and restore available', done: true },
    { label: 'Billing counter scheduled for Phase 3', done: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 1"
        title="Counter foundation is ready"
        description="The offline database, shop profile, bilingual shell and backup system are live. The fast billing counter arrives in Phase 3."
        actions={
          <Button
            variant="secondary"
            onClick={() => onNavigate('settings')}
          >
            <Settings className="h-4 w-4" />
            Shop settings
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={String(stats?.productCount ?? 0)}
          detail="Seeded SKUs ready for catalog work"
          icon={Package}
          tone="emerald"
        />
        <StatCard
          label="Customers"
          value={String(stats?.customerCount ?? 0)}
          detail="Village-wise customer records"
          icon={Users}
          tone="sky"
        />
        <StatCard
          label="Low stock"
          value={String(stats?.lowStockCount ?? 0)}
          detail="At or below reorder threshold"
          icon={TriangleAlert}
          tone="amber"
        />
        <StatCard
          label="Udhaar pending"
          value={formatINR0(stats?.udhaarTotal ?? 0)}
          detail={`${stats?.invoiceCount ?? 0} bills recorded`}
          icon={IndianRupee}
          tone="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Phase 1 readiness
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Everything below is stored locally on this laptop.
              </p>
            </div>
            <Badge variant="success">v{APP_VERSION}</Badge>
          </div>

          <ul className="mt-5 space-y-3">
            {readiness.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 text-sm text-slate-700"
              >
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Clock3 className="h-5 w-5 shrink-0 text-amber-500" />
                )}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => onNavigate('inventory')}>
              Next: Inventory
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate('barcode')}
            >
              Barcode studio
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            What Phase 3 adds
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The counter is designed for under 8 seconds per bill.
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {[
              'Global USB barcode scanner listener',
              'Five hold-bill tabs for peak hours',
              'Serial/IMEI and warranty capture',
              'Cash, UPI, split and udhaar checkout',
              'Dynamic amount-locked UPI QR',
              'Thermal, A4 and WhatsApp receipts',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Sample catalog
            </h2>
            <p className="text-sm text-slate-500">
              Seeded electronics and electrical products.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('inventory')}
          >
            View inventory
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Stock</th>
                <th className="px-5 py-3 text-right font-semibold">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(stats?.sampleProducts ?? []).map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {product.brand} · {product.rackLocation}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {product.category}
                  </td>
                  <td className="px-5 py-3">
                    {product.stockQty <= product.lowStockThreshold ? (
                      <Badge variant="warning">
                        {product.stockQty} {product.unit}
                      </Badge>
                    ) : (
                      <span className="text-slate-600">
                        {product.stockQty} {product.unit}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">
                    {formatINR(product.sellingPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
