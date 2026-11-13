import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Barcode,
  Download,
  FileDown,
  FileUp,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { db } from '../../db/database';
import type { Product } from '../../types/pos';
import {
  calcMarginPercent,
  formatINR,
  formatINR0,
} from '../../lib/money';
import {
  isProductLowStock,
  isProductOutOfStock,
  isProductUnbarcoded,
} from '../../lib/productValidation';
import { downloadCsv } from '../../lib/download';
import {
  productCsvTemplate,
  productsToCsv,
} from '../../lib/csv';
import {
  generateBarcodeForProduct,
  generateMissingBarcodes,
  importProductsFromCsv,
} from '../../services/products';
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
import { ProductModal } from './ProductModal';
import { StockInModal } from './StockInModal';

type StockFilter = 'all' | 'low' | 'out' | 'unbarcoded';

export function InventoryView() {
  const products = useLiveQuery(async () => {
    const rows = await db.products.toArray();
    return rows
      .filter((product) => !product.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [barcodeBusyId, setBarcodeBusyId] = useState<string | null>(null);
  const [generateAllBusy, setGenerateAllBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allProducts = useMemo(() => products ?? [], [products]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(allProducts.map((product) => product.category).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [allProducts],
  );

  const stats = useMemo(
    () => ({
      total: allProducts.length,
      stockValue: allProducts.reduce(
        (total, product) => total + product.purchasePrice * product.stockQty,
        0,
      ),
      lowStock: allProducts.filter(isProductLowStock).length,
      outOfStock: allProducts.filter(isProductOutOfStock).length,
      unbarcoded: allProducts.filter(isProductUnbarcoded).length,
    }),
    [allProducts],
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allProducts.filter((product) => {
      if (category !== 'all' && product.category !== category) {
        return false;
      }
      if (stockFilter === 'low' && !isProductLowStock(product)) {
        return false;
      }
      if (stockFilter === 'out' && !isProductOutOfStock(product)) {
        return false;
      }
      if (stockFilter === 'unbarcoded' && !isProductUnbarcoded(product)) {
        return false;
      }
      if (term === '') {
        return true;
      }
      return [
        product.name,
        product.nameLocal,
        product.skuCode,
        product.barcode,
        product.brand,
        product.category,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [allProducts, category, search, stockFilter]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openAddProduct() {
    setEditingProduct(null);
    setProductModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductModalOpen(true);
  }

  function handleExport() {
    if (allProducts.length === 0) {
      setToast({ tone: 'info', message: 'There are no products to export.' });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`grambill-products-${stamp}.csv`, productsToCsv(allProducts));
    setToast({
      tone: 'success',
      message: `Exported ${allProducts.length} products to CSV.`,
    });
  }

  function handleTemplate() {
    downloadCsv('grambill-product-template.csv', productCsvTemplate());
    setToast({ tone: 'success', message: 'CSV template downloaded.' });
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    setImportBusy(true);
    try {
      const text = await file.text();
      const result = await importProductsFromCsv(text);
      const summary = [
        result.created > 0 ? `${result.created} created` : '',
        result.updated > 0 ? `${result.updated} updated` : '',
        result.skipped > 0 ? `${result.skipped} skipped` : '',
      ]
        .filter(Boolean)
        .join(', ');

      if (result.errors.length > 0) {
        setToast({
          tone: 'error',
          message: `${summary || 'No rows imported'}. ${result.errors
            .slice(0, 2)
            .join(' ')}`,
        });
      } else {
        setToast({
          tone: 'success',
          message: `CSV import complete: ${summary || 'no changes'}.`,
        });
      }
    } catch (error) {
      setToast({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not import this CSV file.',
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function handleGenerateBarcode(product: Product) {
    setBarcodeBusyId(product.id);
    try {
      const barcode = await generateBarcodeForProduct(product.id);
      setToast({
        tone: 'success',
        message: `Generated barcode ${barcode} for ${product.name}.`,
      });
    } catch (error) {
      setToast({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not generate a barcode.',
      });
    } finally {
      setBarcodeBusyId(null);
    }
  }

  async function handleGenerateMissing() {
    setGenerateAllBusy(true);
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
      setGenerateAllBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phase 2"
        title="Inventory & Stock"
        description="Manage your catalog, floor prices, stock-ins, CSV imports and barcode readiness."
        actions={
          <>
            <Button variant="secondary" onClick={handleTemplate}>
              <FileDown className="h-4 w-4" />
              Template
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importBusy}
            >
              {importBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              Import CSV
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={openAddProduct}>
              <Plus className="h-4 w-4" />
              Add product
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="text/csv,.csv"
        className="hidden"
        onChange={(event) => void handleImportFile(event)}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          value={String(stats.total)}
          detail={`${stats.unbarcoded} without barcode`}
          icon={Package}
          tone="emerald"
        />
        <StatCard
          label="Stock value"
          value={formatINR0(stats.stockValue)}
          detail="At purchase cost"
          icon={Wallet}
          tone="sky"
        />
        <StatCard
          label="Low stock"
          value={String(stats.lowStock)}
          detail="At or below alert level"
          icon={TriangleAlert}
          tone="amber"
        />
        <StatCard
          label="Out of stock"
          value={String(stats.outOfStock)}
          detail="Needs reorder now"
          icon={PackagePlus}
          tone="rose"
        />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, SKU, barcode or brand"
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(event.target.value as StockFilter)
            }
            aria-label="Filter by stock status"
          >
            <option value="all">All stock levels</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="unbarcoded">No barcode</option>
          </Select>
          {stats.unbarcoded > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void handleGenerateMissing()}
              disabled={generateAllBusy}
            >
              {generateAllBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Barcode className="h-4 w-4" />
              )}
              Generate missing
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filteredProducts.length} of {allProducts.length} products.
          CSV import updates existing SKUs and keeps their current stock.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Product catalog
            </h2>
            <p className="text-sm text-slate-500">
              Floor price protects margin during billing.
            </p>
          </div>
          <Badge variant="info">{filteredProducts.length} shown</Badge>
        </div>

        {allProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">
              <Package className="h-8 w-8" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                No products yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add your first product or import a CSV template.
              </p>
            </div>
            <Button onClick={openAddProduct}>
              <Plus className="h-4 w-4" />
              Add product
            </Button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-900">
              No products match these filters.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Clear the search or choose a different stock filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Selling / floor
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">Margin</th>
                  <th className="px-5 py-3 font-semibold">Barcode</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const margin = calcMarginPercent(
                    product.sellingPrice,
                    product.purchasePrice,
                  );
                  const outOfStock = isProductOutOfStock(product);
                  const lowStock = isProductLowStock(product);
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80">
                      <td className="max-w-[320px] px-5 py-3">
                        <p className="font-medium text-slate-900">
                          {product.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {product.nameLocal || product.brand}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                          {product.skuCode}
                          {product.rackLocation
                            ? ` · ${product.rackLocation}`
                            : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {product.category}
                        <p className="text-xs text-slate-400">
                          {product.unit}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        {outOfStock ? (
                          <Badge variant="danger">Out</Badge>
                        ) : lowStock ? (
                          <Badge variant="warning">
                            {product.stockQty} {product.unit}
                          </Badge>
                        ) : (
                          <span className="font-medium text-slate-700">
                            {product.stockQty} {product.unit}
                          </span>
                        )}
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Alert at {product.lowStockThreshold}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="font-semibold text-slate-900">
                          {formatINR(product.sellingPrice)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Floor {formatINR(product.minSellingPrice)}
                        </p>
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-right font-semibold',
                          margin < 0 ? 'text-rose-600' : 'text-emerald-700',
                        )}
                      >
                        {margin}%
                      </td>
                      <td className="px-5 py-3">
                        {product.barcode ? (
                          <span className="font-mono text-xs text-slate-600">
                            {product.barcode}
                          </span>
                        ) : (
                          <Badge variant="warning">Not set</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {!product.barcode ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Generate barcode"
                              onClick={() => void handleGenerateBarcode(product)}
                              disabled={barcodeBusyId === product.id}
                            >
                              {barcodeBusyId === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Barcode className="h-4 w-4" />
                              )}
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Stock in"
                            onClick={() => setStockProduct(product)}
                          >
                            <PackagePlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit product"
                            onClick={() => openEditProduct(product)}
                          >
                            <Pencil className="h-4 w-4" />
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

      <ProductModal
        open={productModalOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => {
          setProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSaved={(message) => setToast({ tone: 'success', message })}
      />

      <StockInModal
        open={Boolean(stockProduct)}
        product={stockProduct}
        onClose={() => setStockProduct(null)}
        onSaved={(message) => setToast({ tone: 'success', message })}
      />

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
