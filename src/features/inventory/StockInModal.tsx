import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import type { Product } from '../../types/pos';
import { formatINR, round2 } from '../../lib/money';
import { stockInProduct } from '../../services/products';
import {
  Button,
  Field,
  Input,
  Modal,
} from '../../components/ui/primitives';

interface StockInModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function StockInModal({
  open,
  product,
  onClose,
  onSaved,
}: StockInModalProps) {
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !product) {
      return;
    }
    setQuantity('');
    setPurchasePrice(String(product.purchasePrice));
    setReference('');
    setError(null);
  }, [open, product]);

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(purchasePrice);
  const nextStock =
    product && Number.isFinite(parsedQuantity)
      ? round2(product.stockQty + parsedQuantity)
      : product?.stockQty ?? 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) {
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError('Enter a stock quantity greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid purchase price.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await stockInProduct({
        productId: product.id,
        quantity: parsedQuantity,
        purchasePrice: parsedPrice,
        reference,
      });
      onSaved(
        `Added ${parsedQuantity} ${product.unit} to ${product.name}.`,
      );
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not update stock.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Quick stock in"
      description={
        product
          ? `${product.name} · ${product.skuCode}`
          : 'Choose a product to add stock.'
      }
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" form="stock-in-form" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="h-4 w-4" />
            )}
            {busy ? 'Adding...' : 'Add stock'}
          </Button>
        </>
      }
    >
      <form id="stock-in-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current stock
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {product?.stockQty ?? 0} {product?.unit}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              After stock in
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {nextStock} {product?.unit}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Purchase value
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatINR(
                Number.isFinite(parsedQuantity) && Number.isFinite(parsedPrice)
                  ? parsedQuantity * parsedPrice
                  : 0,
              )}
            </p>
          </div>
        </div>

        <Field label="Quantity received" htmlFor="stock-quantity" required>
          <Input
            id="stock-quantity"
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setError(null);
            }}
            placeholder="10"
            autoFocus
          />
        </Field>

        <Field
          label="Purchase price per unit"
          htmlFor="stock-price"
          hint="Updates product cost"
        >
          <Input
            id="stock-price"
            type="number"
            min="0"
            step="0.01"
            value={purchasePrice}
            onChange={(event) => {
              setPurchasePrice(event.target.value);
              setError(null);
            }}
          />
        </Field>

        <Field
          label="Supplier bill / reference"
          htmlFor="stock-reference"
          hint="Optional"
        >
          <Input
            id="stock-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Supplier bill number or note"
          />
        </Field>
      </form>
    </Modal>
  );
}
