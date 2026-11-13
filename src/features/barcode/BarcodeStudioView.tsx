import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Barcode,
  Layers,
  Loader2,
  Printer,
  Search,
  Tags,
} from 'lucide-react';
import { db } from '../../db/database';
import type { Product } from '../../types/pos';
import { formatINR0 } from '../../lib/money';
import { generateMissingBarcodes } from '../../services/products';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Toast,
  type ToastMessage,
} from '../../components/ui/primitives';
import {
  BarcodePrintSheet,
  LabelCell,
} from './BarcodePrintSheet';
import {
  buildLabelPages,
  LABEL_LAYOUTS,
  LABEL_LAYOUT_LIST,
  layoutCapacity,
  selectionLabelCount,
  type LabelLayout,
  type LabelLayoutId,
  type LabelProduct,
  type LabelSelection,
} from './labelLayouts';

function PreviewLabel({
  product,
  layout,
  shopName,
  showShopName,
  showPrice,
  showMrp,
  note,
}: {
  product: LabelProduct;
  layout: LabelLayout;
  shopName: string;
  showShopName: boolean;
  showPrice: boolean;
  showMrp: boolean;
  note: string;
}) {
  const scale = layout.thermal ? 2.6 : 2.2;
  return (
    <div className="flex min-h-[190px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 p-4">
      <div
        className="overflow-hidden rounded border border-slate-300 bg-white shadow-sm"
        style={{
          width: `${layout.labelWidthMm * scale}mm`,
          height: `${layout.labelHeightMm * scale}mm`,
        }}
      >
        <div
          className="origin-top-left"
          style={{
            width: `${layout.labelWidthMm}mm`,
            height: `${layout.labelHeightMm}mm`,
            transform: `scale(${scale})`,
          }}
        >
          <LabelCell
            product={product}
            layout={layout}
            shopName={shopName}
            showShopName={showShopName}
            showPrice={showPrice}
            showMrp={showMrp}
            note={note}
          />
        </div>
      </div>
    </div>
  );
}

function SimplePreview({ product }: { product: LabelProduct }) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-100 p-4 text-center">
      <Barcode className="h-7 w-7 text-slate-400" />
      <div>
        <p className="text-sm font-semibold text-slate-800">{product.name}</p>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {product.barcode || 'No barcode yet'}
        </p>
      </div>
    </div>
  );
}

export function BarcodeStudioView() {
  const products = useLiveQuery(async () => {
    const rows = await db.products.toArray();
    return rows
      .filter((product) => !product.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const [search, setSearch] = useState('');
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [layoutId, setLayoutId] = useState<LabelLayoutId>('a4_65');
  const [skipCount, setSkipCount] = useState(0);
  const [showShopName, setShowShopName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showMrp, setShowMrp] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const allProducts = useMemo(() => products ?? [], [products]);
  const shopName = useLiveQuery(
    async () => (await db.shopSettings.toCollection().first())?.shopName ?? '',
    [],
  );

  const layout = LABEL_LAYOUTS[layoutId];
  const capacity = layoutCapacity(layout);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === '') {
      return allProducts;
    }
    return allProducts.filter((product) =>
      [
        product.name,
        product.nameLocal,
        product.skuCode,
        product.barcode,
        product.brand,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [allProducts, search]);

  const selections = useMemo<LabelSelection[]>(
    () =>
      allProducts.flatMap((product) => {
        const count = copies[product.id] ?? 0;
        return count > 0 ? [{ product, copies: count }] : [];
      }),
    [allProducts, copies],
  );

  const totalLabels = selectionLabelCount(selections);
  const pages = useMemo(
    () => buildLabelPages(selections, layout, skipCount),
    [layout, selections, skipCount],
  );
  const previewProduct =
    selections[0]?.product ?? filteredProducts[0] ?? allProducts[0];
  const missingBarcode = selections.filter(
    (selection) => selection.product.barcode.trim() === '',
  );
  const unbarcodedCount = allProducts.filter(
    (product) => product.barcode.trim() === '',
  ).length;

  function handleLayoutChange(nextId: LabelLayoutId) {
    setLayoutId(nextId);
    const nextCapacity = layoutCapacity(LABEL_LAYOUTS[nextId]);
    setSkipCount((current) => Math.min(current, Math.max(0, nextCapacity - 1)));
  }

  function handleSkipChange(value: string) {
    const next = Math.max(0, Math.min(capacity - 1, Math.trunc(Number(value))));
    setSkipCount(Number.isFinite(next) ? next : 0);
  }

  function toggleProduct(product: Product, checked: boolean) {
    setCopies((current) => {
      const next = { ...current };
      if (checked) {
        next[product.id] = Math.max(1, next[product.id] ?? 1);
      } else {
        delete next[product.id];
      }
      return next;
    });
  }

  function updateCopies(productId: string, value: string) {
    const count = Math.max(0, Math.trunc(Number(value)));
    setCopies((current) => {
      const next = { ...current };
      if (!Number.isFinite(count) || count <= 0) {
        delete next[productId];
      } else {
        next[productId] = count;
      }
      return next;
    });
  }

  function selectVisible() {
    setCopies((current) => {
      const next = { ...current };
      for (const product of filteredProducts) {
        next[product.id] = Math.max(1, next[product.id] ?? 1);
      }
      return next;
    });
  }

  async function handleGenerateMissing() {
    setBusy(true);
    try {
      const generated = await generateMissingBarcodes();
      setToast({
        tone: generated.size > 0 ? 'success' : 'info',
        message:
          generated.size > 0
            ? `Generated ${generated.size} barcode${
                generated.size === 1 ? '' : 's'
              }.`
            : 'Every product already has a barcode.',
      });
    } catch (error) {
      setToast({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not generate barcodes.',
      });
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    if (totalLabels === 0) {
      setToast({
        tone: 'info',
        message: 'Select at least one product and set its label copies.',
      });
      return;
    }
    if (missingBarcode.length > 0) {
      setToast({
        tone: 'error',
        message: `${missingBarcode.length} selected product${
          missingBarcode.length === 1 ? ' has' : 's have'
        } no barcode. Generate missing barcodes first.`,
      });
      return;
    }
    window.print();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 2"
        title="Free Barcode & Label Studio"
        description="Generate CODE128 barcodes for local items, customize sticker labels and print on A4 sheets or thermal rolls."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void handleGenerateMissing()}
              disabled={busy || unbarcodedCount === 0}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Barcode className="h-4 w-4" />
              )}
              Generate missing
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print labels
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Selected products"
          value={String(selections.length)}
          detail={`${allProducts.length} in catalog`}
          icon={Tags}
          tone="emerald"
        />
        <StatCard
          label="Labels to print"
          value={String(totalLabels)}
          detail={`${skipCount} positions skipped`}
          icon={Printer}
          tone="sky"
        />
        <StatCard
          label="Print sheets"
          value={String(pages.length)}
          detail={`${capacity} labels per sheet`}
          icon={Layers}
          tone="amber"
        />
        <StatCard
          label="No barcode"
          value={String(unbarcodedCount)}
          detail="Generate before printing"
          icon={Barcode}
          tone={unbarcodedCount > 0 ? 'rose' : 'emerald'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Sheet & label settings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Layouts use millimeter dimensions for predictable sticker printing.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Sticker layout" htmlFor="label-layout">
              <Select
                id="label-layout"
                value={layoutId}
                onChange={(event) =>
                  handleLayoutChange(event.target.value as LabelLayoutId)
                }
              >
                {LABEL_LAYOUT_LIST.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500">{layout.description}</p>
            </Field>
            <Field
              label="Skip used positions"
              htmlFor="label-skip"
              hint={`0-${Math.max(0, capacity - 1)}`}
            >
              <Input
                id="label-skip"
                type="number"
                min="0"
                max={Math.max(0, capacity - 1)}
                step="1"
                value={skipCount}
                onChange={(event) => handleSkipChange(event.target.value)}
                disabled={capacity <= 1}
              />
              <p className="text-xs text-slate-500">
                Leaves the first stickers blank on a partly used sheet.
              </p>
            </Field>
            <Field
              label="Extra label note"
              htmlFor="label-note"
              hint="Optional"
              className="sm:col-span-2"
            >
              <Input
                id="label-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={40}
                placeholder="Example: No return on loose items"
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showShopName}
                onChange={(event) => setShowShopName(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
              />
              Shop name
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(event) => setShowPrice(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
              />
              Selling price
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showMrp}
                onChange={(event) => setShowMrp(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
              />
              MRP
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Label preview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {layout.name}
              </p>
            </div>
            {previewProduct?.barcode ? (
              <Badge variant="success">CODE128</Badge>
            ) : (
              <Badge variant="warning">No barcode</Badge>
            )}
          </div>
          <div className="mt-4">
            {previewProduct ? (
              previewProduct.barcode ? (
                <PreviewLabel
                  product={previewProduct}
                  layout={layout}
                  shopName={shopName ?? ''}
                  showShopName={showShopName}
                  showPrice={showPrice}
                  showMrp={showMrp}
                  note={note}
                />
              ) : (
                <SimplePreview product={previewProduct} />
              )
            ) : (
              <div className="flex min-h-[190px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Add products to preview a label.
              </div>
            )}
          </div>
          {previewProduct ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              {previewProduct.name} · {formatINR0(previewProduct.sellingPrice)}
            </p>
          ) : null}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Choose products
            </h2>
            <p className="text-sm text-slate-500">
              Set how many copies of each sticker you need.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products"
                className="pl-9 sm:w-64"
              />
            </div>
            <Button variant="secondary" onClick={selectVisible}>
              Select visible
            </Button>
            <Button variant="ghost" onClick={() => setCopies({})}>
              Clear
            </Button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No products match this search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3 font-semibold">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Barcode</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Label copies
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const count = copies[product.id] ?? 0;
                  return (
                    <tr
                      key={product.id}
                      className={count > 0 ? 'bg-emerald-50/40' : undefined}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={count > 0}
                          onChange={(event) =>
                            toggleProduct(product, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.skuCode}
                          {product.rackLocation
                            ? ` · ${product.rackLocation}`
                            : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {product.barcode ? (
                          <span className="font-mono text-xs text-slate-600">
                            {product.barcode}
                          </span>
                        ) : (
                          <Badge variant="warning">Generate first</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {formatINR0(product.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={count === 0 ? '' : count}
                          onChange={(event) =>
                            updateCopies(product.id, event.target.value)
                          }
                          placeholder="0"
                          className="ml-auto h-9 w-20 text-center"
                          aria-label={`Label copies for ${product.name}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <BarcodePrintSheet
        pages={pages}
        layout={layout}
        shopName={shopName ?? ''}
        showShopName={showShopName}
        showPrice={showPrice}
        showMrp={showMrp}
        note={note}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
