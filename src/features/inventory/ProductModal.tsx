import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
import type { GstRate, Product, ProductForm, Unit } from '../../types/pos';
import {
  emptyProductForm,
  GST_RATE_OPTIONS,
  normalizeProductForm,
  productToForm,
  UNIT_OPTIONS,
  validateProductForm,
  type ProductFormErrors,
} from '../../lib/productValidation';
import { calcMarginPercent, calcProfit, formatINR } from '../../lib/money';
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from '../../services/products';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
} from '../../components/ui/primitives';

interface ProductModalProps {
  open: boolean;
  product: Product | null;
  categories: string[];
  initialBarcode?: string;
  onClose: () => void;
  onSaved: (message: string, product?: Product) => void;
}

function inputNumber(value: number): string {
  return value === 0 ? '' : String(value);
}

function numberFromInput(value: string): number {
  return value.trim() === '' ? 0 : Number(value);
}

export function ProductModal({
  open,
  product,
  categories,
  initialBarcode = '',
  onClose,
  onSaved,
}: ProductModalProps) {
  const [form, setForm] = useState<ProductForm>(() => emptyProductForm());
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextForm = product
      ? productToForm(product)
      : { ...emptyProductForm(), barcode: initialBarcode };
    setForm(nextForm);
    setErrors({});
    setSubmitError(null);
  }, [open, product, initialBarcode]);

  const profit = useMemo(
    () => calcProfit(form.sellingPrice, form.purchasePrice),
    [form.purchasePrice, form.sellingPrice],
  );
  const margin = useMemo(
    () => calcMarginPercent(form.sellingPrice, form.purchasePrice),
    [form.purchasePrice, form.sellingPrice],
  );

  function updateField<K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = normalizeProductForm(form);
    const nextErrors = validateProductForm(cleaned);
    setForm(cleaned);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('Please fix the highlighted fields.');
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      if (product) {
        const saved = await updateProduct(product.id, cleaned);
        onSaved('Product updated.', saved);
      } else {
        const saved = await createProduct(cleaned);
        onSaved('Product added to inventory.', saved);
      }
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not save the product.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!product) {
      return;
    }
    if (
      !window.confirm(
        `Delete ${product.name}? Existing bills will not be affected.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await deleteProduct(product.id);
      onSaved('Product removed from inventory.');
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not delete the product.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={product ? 'Edit product' : 'Add product'}
      description={
        product
          ? 'Update catalog details. Use Stock In to change stock quantity.'
          : 'Create a new catalog item with its opening stock and floor price.'
      }
      onClose={onClose}
      size="xl"
      footer={
        <>
          {product ? (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              onClick={() => void handleDelete()}
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {busy ? 'Saving...' : product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        {submitError ? (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            role="alert"
          >
            {submitError}
          </div>
        ) : null}

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Product details
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Product name" htmlFor="product-name" required error={errors.name}>
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Havells 9W LED Bulb"
              />
            </Field>
            <Field label="Local / Hindi name" htmlFor="product-name-local">
              <Input
                id="product-name-local"
                value={form.nameLocal}
                onChange={(event) =>
                  updateField('nameLocal', event.target.value)
                }
                placeholder="हैवेल्स 9W एलईडी बल्ब"
              />
            </Field>
            <Field label="Category" htmlFor="product-category" required error={errors.category}>
              <Input
                id="product-category"
                list="product-categories"
                value={form.category}
                onChange={(event) =>
                  updateField('category', event.target.value)
                }
                placeholder="Lighting"
              />
              <datalist id="product-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
            <Field label="Brand" htmlFor="product-brand">
              <Input
                id="product-brand"
                value={form.brand}
                onChange={(event) => updateField('brand', event.target.value)}
                placeholder="Havells"
              />
            </Field>
            <Field label="Unit" htmlFor="product-unit" error={errors.unit}>
              <Select
                id="product-unit"
                value={form.unit}
                onChange={(event) =>
                  updateField('unit', event.target.value as Unit)
                }
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="HSN code" htmlFor="product-hsn">
              <Input
                id="product-hsn"
                value={form.hsnCode}
                onChange={(event) =>
                  updateField('hsnCode', event.target.value)
                }
                placeholder="8539"
              />
            </Field>
            <Field
              label="Barcode"
              htmlFor="product-barcode"
              hint="Optional"
              error={errors.barcode}
              className="sm:col-span-2"
            >
              <Input
                id="product-barcode"
                value={form.barcode}
                onChange={(event) =>
                  updateField('barcode', event.target.value)
                }
                placeholder="Leave blank to generate SKU barcode later"
              />
            </Field>
            <Field label="SKU code" htmlFor="product-sku">
              <Input
                id="product-sku"
                value={form.skuCode}
                readOnly
                className="bg-slate-50 font-mono text-slate-600"
                placeholder="Generated automatically"
              />
            </Field>
            <Field label="Rack location" htmlFor="product-rack">
              <Input
                id="product-rack"
                value={form.rackLocation}
                onChange={(event) =>
                  updateField('rackLocation', event.target.value)
                }
                placeholder="Rack A - Shelf 1"
              />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Pricing & tax
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Purchase price" htmlFor="product-purchase" error={errors.purchasePrice}>
              <Input
                id="product-purchase"
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(form.purchasePrice)}
                onChange={(event) =>
                  updateField(
                    'purchasePrice',
                    numberFromInput(event.target.value),
                  )
                }
              />
            </Field>
            <Field label="MRP" htmlFor="product-mrp" error={errors.mrp}>
              <Input
                id="product-mrp"
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(form.mrp)}
                onChange={(event) =>
                  updateField('mrp', numberFromInput(event.target.value))
                }
              />
            </Field>
            <Field label="Selling price" htmlFor="product-selling" error={errors.sellingPrice}>
              <Input
                id="product-selling"
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(form.sellingPrice)}
                onChange={(event) =>
                  updateField(
                    'sellingPrice',
                    numberFromInput(event.target.value),
                  )
                }
              />
            </Field>
            <Field
              label="Floor price"
              htmlFor="product-floor"
              error={errors.minSellingPrice}
            >
              <Input
                id="product-floor"
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(form.minSellingPrice)}
                onChange={(event) =>
                  updateField(
                    'minSellingPrice',
                    numberFromInput(event.target.value),
                  )
                }
              />
            </Field>
            <Field label="GST rate" htmlFor="product-gst" error={errors.gstRate}>
              <Select
                id="product-gst"
                value={form.gstRate}
                onChange={(event) =>
                  updateField('gstRate', Number(event.target.value) as GstRate)
                }
              >
                {GST_RATE_OPTIONS.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 sm:col-span-1">
              <input
                type="checkbox"
                checked={form.taxInclusive}
                onChange={(event) =>
                  updateField('taxInclusive', event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
              />
              Price includes GST
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Margin at selling price
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {formatINR(profit)}{' '}
                <span className="text-sm font-medium text-slate-500">
                  ({margin}%)
                </span>
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Stock, serial & warranty
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label={product ? 'Current stock' : 'Opening stock'}
              htmlFor="product-stock"
              error={errors.stockQty}
              hint={product ? 'Use Stock In' : undefined}
            >
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(form.stockQty)}
                onChange={(event) =>
                  updateField('stockQty', numberFromInput(event.target.value))
                }
                readOnly={Boolean(product)}
                className={product ? 'bg-slate-50 text-slate-600' : undefined}
              />
            </Field>
            <Field
              label="Low-stock alert at"
              htmlFor="product-low-stock"
              error={errors.lowStockThreshold}
            >
              <Input
                id="product-low-stock"
                type="number"
                min="0"
                step="1"
                value={inputNumber(form.lowStockThreshold)}
                onChange={(event) =>
                  updateField(
                    'lowStockThreshold',
                    numberFromInput(event.target.value),
                  )
                }
              />
            </Field>
            <Field
              label="Warranty months"
              htmlFor="product-warranty"
              error={errors.defaultWarrantyMonths}
            >
              <Input
                id="product-warranty"
                type="number"
                min="0"
                step="1"
                value={inputNumber(form.defaultWarrantyMonths)}
                onChange={(event) =>
                  updateField(
                    'defaultWarrantyMonths',
                    numberFromInput(event.target.value),
                  )
                }
              />
            </Field>
            <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.trackSerialImei}
                onChange={(event) =>
                  updateField('trackSerialImei', event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
              />
              Track serial / IMEI
            </label>
          </div>
        </section>
      </form>
    </Modal>
  );
}
