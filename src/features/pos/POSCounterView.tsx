import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Clock3,
  Minus,
  Percent,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  UserPlus,
} from 'lucide-react';
import { db } from '../../db/database';
import type {
  Customer,
  Invoice,
  InvoiceType,
  Product,
} from '../../types/pos';
import { nowIso } from '../../lib/date';
import { normalizeBarcode } from '../../lib/id';
import { formatINR, formatINR0, round2 } from '../../lib/money';
import { cn } from '../../lib/cn';
import { useSettings } from '../../hooks/useSettings';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { playCheckoutChime, playScanBeep } from '../../lib/sound';
import type { CheckoutResult } from '../../services/invoices';
import type { CheckoutCustomerInput } from '../../services/invoices';
import type { ViewKey } from '../../app/navigation';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Toast,
  type ToastMessage,
} from '../../components/ui/primitives';
import { ProductModal } from '../inventory/ProductModal';
import {
  calculateCart,
  calculateCartLine,
  cartLineFromProduct,
  isBelowFloorPrice,
  loadHoldSlots,
  saveHoldSlots,
  withPercentDiscount,
  type CartLine,
  type HoldBill,
  type HoldSlots,
} from './cart';
import { CameraScannerModal } from './CameraScannerModal';
import { CheckoutModal } from './CheckoutModal';
import { CustomerPicker } from './CustomerPicker';
import { InvoiceReceiptModal } from './InvoiceReceiptModal';

interface POSCounterViewProps {
  onNavigate: (view: ViewKey) => void;
}

interface ReceiptState {
  invoice: Invoice;
  customerBalance?: number;
}

function snapshotHold(
  lines: CartLine[],
  extraBillDiscount: number,
  invoiceType: InvoiceType,
  customer: CheckoutCustomerInput | null,
): HoldBill | null {
  if (lines.length === 0 && !customer) {
    return null;
  }
  return {
    items: lines,
    extraBillDiscount,
    invoiceType,
    customer,
    updatedAt: nowIso(),
  };
}

function numberFromInput(value: string): number {
  if (value.trim() === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSerials(value: string): string[] {
  return value.split(/[,\n]/).map((serial) => serial.trim());
}

export function POSCounterView({ onNavigate }: POSCounterViewProps) {
  const settings = useSettings();
  const products = useLiveQuery(
    () =>
      db.products
        .toArray()
        .then((rows) =>
          rows
            .filter((product) => !product.deletedAt)
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
    [],
  );

  const [holds, setHolds] = useState<HoldSlots>(() => loadHoldSlots());
  const [activeSlot, setActiveSlot] = useState(0);
  const [lines, setLines] = useState<CartLine[]>(
    () => holds[0]?.items ?? [],
  );
  const [extraBillDiscount, setExtraBillDiscount] = useState(
    () => holds[0]?.extraBillDiscount ?? 0,
  );
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(
    () => holds[0]?.invoiceType ?? 'gst_tax_invoice',
  );
  const [customer, setCustomer] = useState<CheckoutCustomerInput | null>(
    () => holds[0]?.customer ?? null,
  );
  const [search, setSearch] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allProducts = useMemo(() => products ?? [], [products]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(allProducts.map((product) => product.category).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [allProducts],
  );

  const totals = useMemo(
    () => calculateCart(lines, extraBillDiscount, invoiceType),
    [lines, extraBillDiscount, invoiceType],
  );

  const gstPricing = useMemo(() => {
    if (invoiceType !== 'gst_tax_invoice' || lines.length === 0) {
      return 'none';
    }
    const inclusive = lines.filter((line) => line.taxInclusive).length;
    if (inclusive === lines.length) {
      return 'included';
    }
    if (inclusive === 0) {
      return 'added';
    }
    return 'mixed';
  }, [lines, invoiceType]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === '') {
      return allProducts.slice(0, 18);
    }
    return allProducts
      .filter((product) =>
        [
          product.name,
          product.nameLocal,
          product.skuCode,
          product.barcode,
          product.brand,
          product.category,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 30);
  }, [allProducts, search]);

  const belowFloorCount = lines.filter(isBelowFloorPrice).length;

  useEffect(() => {
    saveHoldSlots(holds);
  }, [holds]);

  useEffect(() => {
    setHolds((current) => {
      const next = [...current];
      const snapshot = snapshotHold(
        lines,
        extraBillDiscount,
        invoiceType,
        customer,
      );
      if (JSON.stringify(next[activeSlot]) === JSON.stringify(snapshot)) {
        return current;
      }
      next[activeSlot] = snapshot;
      return next;
    });
  }, [lines, extraBillDiscount, invoiceType, customer, activeSlot]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === 'F9') {
        event.preventDefault();
        if (lines.length > 0) {
          setCheckoutOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [lines.length]);

  function updateLine(id: string, patch: Partial<CartLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) {
          return line;
        }
        const next = { ...line, ...patch };
        return withPercentDiscount(next, next.discountPercent);
      }),
    );
  }

  function addProductToCart(product: Product) {
    const existing = lines.find((line) => line.productId === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.stockQty) {
        setToast({
          tone: 'error',
          message: `Only ${product.stockQty} ${product.unit} of ${product.name} is in stock.`,
        });
        return;
      }
      updateLine(existing.id, {
        quantity: round2(existing.quantity + 1),
        stockQty: product.stockQty,
      });
    } else {
      if (product.stockQty <= 0) {
        setToast({
          tone: 'error',
          message: `${product.name} is out of stock.`,
        });
        return;
      }
      setLines((current) => [...current, cartLineFromProduct(product)]);
    }
    setSearch('');
    playScanBeep();
  }

  function handleScan(rawBarcode: string) {
    const barcode = normalizeBarcode(rawBarcode);
    if (barcode === '') {
      return;
    }
    const product = allProducts.find(
      (item) =>
        normalizeBarcode(item.barcode) === barcode ||
        item.skuCode.trim().toUpperCase() === barcode.toUpperCase(),
    );
    if (product) {
      addProductToCart(product);
      return;
    }
    setQuickAddBarcode(barcode);
    setToast({
      tone: 'info',
      message: `Barcode ${barcode} is not in inventory. Add it as a new product.`,
    });
  }

  useBarcodeScanner(handleScan, {
    enabled:
      !checkoutOpen &&
      !receipt &&
      !quickAddBarcode &&
      !cameraOpen &&
      !customerPickerOpen,
  });

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (term === '') {
      return;
    }
    const normalized = normalizeBarcode(term).toUpperCase();
    const exact = allProducts.find(
      (product) =>
        normalizeBarcode(product.barcode).toUpperCase() === normalized ||
        product.skuCode.trim().toUpperCase() === normalized,
    );
    if (exact) {
      addProductToCart(exact);
      return;
    }
    if (filteredProducts.length === 1) {
      addProductToCart(filteredProducts[0]);
      return;
    }
    if (term.length >= 4) {
      setQuickAddBarcode(term);
      setToast({
        tone: 'info',
        message: `No product found for ${term}. Add it as a new product.`,
      });
      return;
    }
    setToast({ tone: 'info', message: 'No matching product found.' });
  }

  function handleSlotChange(index: number) {
    if (index === activeSlot) {
      return;
    }
    const currentSnapshot = snapshotHold(
      lines,
      extraBillDiscount,
      invoiceType,
      customer,
    );
    setHolds((current) => {
      const next = [...current];
      next[activeSlot] = currentSnapshot;
      return next;
    });
    const target = holds[index];
    setActiveSlot(index);
    setLines(target?.items ?? []);
    setExtraBillDiscount(target?.extraBillDiscount ?? 0);
    setInvoiceType(target?.invoiceType ?? 'gst_tax_invoice');
    setCustomer(target?.customer ?? null);
    setSearch('');
  }

  function handleHold() {
    const snapshot = snapshotHold(
      lines,
      extraBillDiscount,
      invoiceType,
      customer,
    );
    setHolds((current) => {
      const next = [...current];
      next[activeSlot] = snapshot;
      return next;
    });
    setToast({
      tone: 'success',
      message: snapshot
        ? `Bill ${activeSlot + 1} saved on this laptop.`
        : `Bill ${activeSlot + 1} is empty.`,
    });
  }

  function handleNewBill() {
    if (
      lines.length > 0 &&
      !window.confirm(
        `Start a new bill? Bill ${activeSlot + 1} will be cleared from the hold tabs.`,
      )
    ) {
      return;
    }
    setLines([]);
    setExtraBillDiscount(0);
    setInvoiceType('gst_tax_invoice');
    setCustomer(null);
    setSearch('');
    searchRef.current?.focus();
  }

  function handleCompleted(result: CheckoutResult) {
    setCheckoutOpen(false);
    setReceipt({
      invoice: result.invoice,
      customerBalance: result.customer?.currentUdhaarBalance,
    });
    playCheckoutChime();
    setLines([]);
    setExtraBillDiscount(0);
    setInvoiceType('gst_tax_invoice');
    setCustomer(null);
    setSearch('');
    setHolds((current) => {
      const next = [...current];
      next[activeSlot] = null;
      return next;
    });
  }

  function handleCustomerSelect(selected: Customer) {
    setCustomer({
      id: selected.id,
      name: selected.name,
      phone: selected.phone,
      villageOrArea: selected.villageOrArea,
      gstin: selected.gstin,
    });
  }

  function slotSummary(index: number): { count: number; total: number } {
    if (index === activeSlot) {
      return {
        count: lines.length,
        total: calculateCart(lines, extraBillDiscount, invoiceType).grandTotal,
      };
    }
    const hold = holds[index];
    if (!hold) {
      return { count: 0, total: 0 };
    }
    return {
      count: hold.items.length,
      total: calculateCart(
        hold.items,
        hold.extraBillDiscount,
        hold.invoiceType,
      ).grandTotal,
    };
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Billing"
        title="Billing counter"
        description="Scan or search products, build the cart, capture serial/IMEI and warranty, then checkout with cash, UPI, split or udhaar."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-4 w-4" />
              Camera scan
            </Button>
            <Button variant="secondary" onClick={handleHold}>
              <Clock3 className="h-4 w-4" />
              Hold bill
            </Button>
            <Button variant="secondary" onClick={handleNewBill}>
              <Plus className="h-4 w-4" />
              New bill
            </Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hold tabs
          </span>
          {Array.from({ length: 5 }, (_, index) => {
            const summary = slotSummary(index);
            const active = index === activeSlot;
            return (
              <button
                key={index}
                type="button"
                onClick={() => handleSlotChange(index)}
                className={cn(
                  'flex min-w-[132px] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition',
                  active
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <span>
                  <span
                    className={cn(
                      'block text-xs font-bold',
                      active ? 'text-emerald-800' : 'text-slate-700',
                    )}
                  >
                    Bill {index + 1}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {summary.count === 0
                      ? 'Empty'
                      : `${summary.count} item${
                          summary.count === 1 ? '' : 's'
                        }`}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    summary.total > 0 ? 'text-slate-900' : 'text-slate-400',
                  )}
                >
                  {summary.total > 0 ? formatINR0(summary.total) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <div className="space-y-5">
          <Card className="p-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Scan barcode or search product, SKU, brand..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
            <p className="mt-2 text-xs text-slate-500">
              F2 search · F9 checkout · USB scanner works anywhere outside an
              input
            </p>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Products
                </h2>
                <p className="text-xs text-slate-500">
                  {search.trim()
                    ? `${filteredProducts.length} match${
                        filteredProducts.length === 1 ? '' : 'es'
                      }`
                    : 'Tap a product to add it to the bill'}
                </p>
              </div>
              <Badge variant="neutral">
                {allProducts.length} in catalog
              </Badge>
            </div>

            <div className="max-h-[620px] overflow-y-auto p-3">
              {filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center">
                  <Barcode className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    No product found
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Scan an unknown barcode to quick-add it, or add it from
                    Inventory.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => onNavigate('inventory')}
                  >
                    Open inventory
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredProducts.map((product) => {
                    const outOfStock = product.stockQty <= 0;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProductToCart(product)}
                        disabled={outOfStock}
                        className={cn(
                          'rounded-xl border p-3 text-left transition',
                          outOfStock
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                            {product.name}
                          </p>
                          <span className="shrink-0 text-sm font-bold text-emerald-700">
                            {formatINR(product.sellingPrice)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {product.brand} · {product.category}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-[11px] font-medium',
                              outOfStock
                                ? 'text-rose-600'
                                : product.stockQty <= product.lowStockThreshold
                                  ? 'text-amber-600'
                                  : 'text-slate-500',
                            )}
                          >
                            Stock: {product.stockQty} {product.unit}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {product.barcode || 'No barcode'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                  Current bill
                </h2>
                <p className="text-xs text-slate-500">
                  {lines.length} line{lines.length === 1 ? '' : 's'} in Bill{' '}
                  {activeSlot + 1} ·{' '}
                  {invoiceType === 'gst_tax_invoice'
                    ? 'Pakka GST invoice'
                    : 'Kachha, no GST'}
                </p>
              </div>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setInvoiceType('gst_tax_invoice')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    invoiceType === 'gst_tax_invoice'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  Pakka
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType('non_gst_estimate')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    invoiceType === 'non_gst_estimate'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  Kachha
                </button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ReceiptText className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  Bill is empty
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Scan a barcode, search a product, or tap a product card to
                  start billing.
                </p>
              </div>
            ) : (
              <div className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
                {lines.map((line) => {
                  const lineTotals = calculateCartLine(line, invoiceType);
                  const floorWarning = isBelowFloorPrice(line);
                  const serialCount = line.serialOrImeiNumbers.filter(Boolean)
                    .length;
                  const serialMismatch =
                    line.trackSerialImei &&
                    serialCount !== round2(line.quantity);
                  return (
                    <div key={line.id} className="space-y-3 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {line.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {line.barcode || 'No barcode'} · Stock{' '}
                            {line.stockQty} {line.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((item) => item.id !== line.id),
                            )
                          }
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="text-[11px] font-medium text-slate-500">
                          Qty
                          <div className="mt-1 flex h-9 items-center rounded-lg border border-slate-300 bg-white">
                            <button
                              type="button"
                              className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50"
                              onClick={() =>
                                updateLine(line.id, {
                                  quantity: round2(
                                    Math.max(0, line.quantity - 1),
                                  ),
                                })
                              }
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={line.stockQty}
                              step="0.01"
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  quantity: Math.min(
                                    line.stockQty,
                                    Math.max(
                                      0,
                                      numberFromInput(event.target.value),
                                    ),
                                  ),
                                })
                              }
                              className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-sm font-semibold outline-none"
                            />
                            <button
                              type="button"
                              className="flex h-full w-8 items-center justify-center text-slate-500 hover:bg-slate-50"
                              onClick={() =>
                                updateLine(line.id, {
                                  quantity: round2(
                                    Math.min(
                                      line.stockQty,
                                      line.quantity + 1,
                                    ),
                                  ),
                                })
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </label>

                        <label className="text-[11px] font-medium text-slate-500">
                          Rate
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(event) =>
                              updateLine(line.id, {
                                unitPrice: Math.max(
                                  0,
                                  numberFromInput(event.target.value),
                                ),
                              })
                            }
                            className="mt-1 h-9 px-2 text-sm"
                          />
                        </label>

                        <label className="text-[11px] font-medium text-slate-500">
                          Item discount %
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={line.discountPercent}
                            onChange={(event) =>
                              updateLine(line.id, {
                                discountPercent: Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    numberFromInput(event.target.value),
                                  ),
                                ),
                              })
                            }
                            className="mt-1 h-9 px-2 text-sm"
                          />
                          {line.discountAmount > 0 ? (
                            <span className="mt-1 block text-[10px] font-normal text-emerald-700">
                              {formatINR(line.discountAmount)} off
                            </span>
                          ) : null}
                        </label>

                        <label className="text-[11px] font-medium text-slate-500">
                          Warranty months
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={line.warrantyMonths}
                            onChange={(event) =>
                              updateLine(line.id, {
                                warrantyMonths: Math.max(
                                  0,
                                  Math.trunc(
                                    numberFromInput(event.target.value),
                                  ),
                                ),
                              })
                            }
                            className="mt-1 h-9 px-2 text-sm"
                          />
                        </label>
                      </div>

                      {line.trackSerialImei ? (
                        <div>
                          <p className="text-[11px] font-medium text-slate-500">
                            Serial / IMEI numbers
                            <span
                              className={cn(
                                'ml-2 font-semibold',
                                serialMismatch
                                  ? 'text-rose-600'
                                  : 'text-emerald-700',
                              )}
                            >
                              {serialCount}/{round2(line.quantity)} entered
                            </span>
                          </p>
                          <Input
                            value={line.serialOrImeiNumbers.join(', ')}
                            onChange={(event) =>
                              updateLine(line.id, {
                                serialOrImeiNumbers: parseSerials(
                                  event.target.value,
                                ),
                              })
                            }
                            className="mt-1 h-9 px-2 font-mono text-xs"
                            placeholder="IMEI 1, IMEI 2"
                          />
                        </div>
                      ) : null}

                      {floorWarning ? (
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          Below floor price {formatINR(line.minSellingPrice)}
                        </p>
                      ) : null}

                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-xs text-slate-500">
                          {invoiceType === 'gst_tax_invoice'
                            ? `GST ${line.gstRate}% ${formatINR(
                                lineTotals.taxAmount,
                              )}${line.taxInclusive ? ' incl.' : ' added'}`
                            : 'Kachha · no GST'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatINR(lineTotals.totalAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Customer</span>
                {customer ? (
                  <div className="flex items-center gap-2">
                    <span className="max-w-[190px] truncate text-xs font-medium text-slate-700">
                      {customer.name} · {customer.phone}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomer(null)}
                      className="text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCustomerPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add customer
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="extra-discount"
                  className="flex items-center gap-1.5 text-sm text-slate-600"
                >
                  <Percent className="h-4 w-4 text-slate-400" />
                  Extra discount
                </label>
                <Input
                  id="extra-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={extraBillDiscount}
                  onChange={(event) =>
                    setExtraBillDiscount(
                      Math.max(0, numberFromInput(event.target.value)),
                    )
                  }
                  className="h-9 w-28 px-2 text-right text-sm"
                />
              </div>

              <dl className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd>{formatINR(totals.subtotal)}</dd>
                </div>
                {totals.itemDiscountTotal + totals.extraBillDiscount > 0 ? (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <dt>Discount</dt>
                    <dd>
                      -
                      {formatINR(
                        totals.itemDiscountTotal + totals.extraBillDiscount,
                      )}
                    </dd>
                  </div>
                ) : null}
                {invoiceType === 'gst_tax_invoice' ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">
                      {gstPricing === 'included'
                        ? 'GST (included)'
                        : gstPricing === 'added'
                          ? 'GST (added)'
                          : 'GST'}
                    </dt>
                    <dd>{formatINR(totals.taxAmount)}</dd>
                  </div>
                ) : (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">GST</dt>
                    <dd className="font-medium text-slate-400">Not charged</dd>
                  </div>
                )}
                {totals.roundOff !== 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Round off</dt>
                    <dd>{formatINR(totals.roundOff)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-lg font-bold">
                  <dt>Total</dt>
                  <dd>{formatINR(totals.grandTotal)}</dd>
                </div>
              </dl>

              {invoiceType === 'gst_tax_invoice' && lines.length > 0 ? (
                <p className="text-[11px] leading-4 text-slate-500">
                  {gstPricing === 'included'
                    ? 'Selling prices include GST. The tax is shown on the invoice; the total stays the same.'
                    : gstPricing === 'added'
                      ? 'GST is added on top of the selling prices.'
                      : 'Some prices include GST and some add it; totals follow each product setting.'}
                </p>
              ) : null}

              {belowFloorCount > 0 ? (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {belowFloorCount} line
                  {belowFloorCount === 1 ? ' is' : 's are'} below floor price.
                  Checkout will ask for confirmation.
                </p>
              ) : null}

              <Button
                className="w-full"
                disabled={lines.length === 0 || !settings}
                onClick={() => setCheckoutOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Checkout · {formatINR(totals.grandTotal)}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {settings ? (
        <CheckoutModal
          open={checkoutOpen}
          settings={settings}
          lines={lines}
          totals={totals}
          extraBillDiscount={extraBillDiscount}
          invoiceType={invoiceType}
          customer={customer}
          onCustomerChange={setCustomer}
          onClose={() => setCheckoutOpen(false)}
          onCompleted={handleCompleted}
        />
      ) : null}

      {settings && receipt ? (
        <InvoiceReceiptModal
          open={Boolean(receipt)}
          invoice={receipt.invoice}
          settings={settings}
          customerBalance={receipt.customerBalance}
          onClose={() => setReceipt(null)}
          onNewBill={() => {
            setReceipt(null);
            searchRef.current?.focus();
          }}
        />
      ) : null}

      <CustomerPicker
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={handleCustomerSelect}
      />

      <CameraScannerModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleScan}
      />

      <ProductModal
        open={Boolean(quickAddBarcode)}
        product={null}
        categories={categories}
        initialBarcode={quickAddBarcode ?? ''}
        onClose={() => setQuickAddBarcode(null)}
        onSaved={(message, product) => {
          setToast({ tone: 'success', message });
          setQuickAddBarcode(null);
          if (product) {
            addProductToCart(product);
          }
        }}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
