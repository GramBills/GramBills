import { createPortal } from 'react-dom';
import { formatINR0 } from '../../lib/money';
import { BarcodeSvg } from './BarcodeSvg';
import type {
  LabelLayout,
  LabelProduct,
  LabelSlot,
} from './labelLayouts';

interface BarcodePrintSheetProps {
  pages: LabelSlot[][];
  layout: LabelLayout;
  shopName: string;
  showShopName: boolean;
  showPrice: boolean;
  showMrp: boolean;
  note: string;
}

export function LabelCell({
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
  const compact = layout.thermal;
  return (
    <div
      className="label-cell flex flex-col items-center justify-center overflow-hidden bg-white px-[1mm] py-[0.6mm] text-center text-slate-950"
      style={{
        width: `${layout.labelWidthMm}mm`,
        height: `${layout.labelHeightMm}mm`,
        gap: compact ? '0.35mm' : '0.25mm',
      }}
    >
      {showShopName ? (
        <p
          className="w-full truncate font-semibold uppercase leading-tight tracking-wide"
          style={{ fontSize: compact ? '6pt' : '4.8pt' }}
        >
          {shopName}
        </p>
      ) : null}
      <p
        className="line-clamp-2 w-full font-semibold leading-tight"
        style={{ fontSize: compact ? '7.5pt' : '5.8pt' }}
      >
        {product.name}
      </p>
      <div
        className="label-barcode w-full"
        style={{ height: compact ? '8.5mm' : '6.4mm' }}
      >
        <BarcodeSvg value={product.barcode} height={44} width={1.4} />
      </div>
      <p
        className="w-full truncate font-mono leading-none"
        style={{ fontSize: compact ? '5.5pt' : '4.4pt' }}
      >
        {product.barcode}
      </p>
      {showPrice || showMrp ? (
        <div
          className="flex w-full items-center justify-center gap-[1.5mm] leading-none"
          style={{ fontSize: compact ? '7pt' : '5.6pt' }}
        >
          {showPrice ? (
            <span className="font-bold">SALE {formatINR0(product.sellingPrice)}</span>
          ) : null}
          {showMrp ? (
            <span className="text-slate-600">
              MRP {formatINR0(product.mrp)}
            </span>
          ) : null}
        </div>
      ) : null}
      {note ? (
        <p
          className="w-full truncate leading-none text-slate-600"
          style={{ fontSize: compact ? '5.5pt' : '4.2pt' }}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function BarcodePrintSheet({
  pages,
  layout,
  shopName,
  showShopName,
  showPrice,
  showMrp,
  note,
}: BarcodePrintSheetProps) {
  if (typeof document === 'undefined' || pages.length === 0) {
    return null;
  }

  return createPortal(
    <div className="print-only label-print-sheet">
      <style>{`@page { size: ${layout.pageWidthMm}mm ${layout.pageHeightMm}mm; margin: 0; }`}</style>
      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="label-page relative overflow-hidden bg-white"
          style={{
            width: `${layout.pageWidthMm}mm`,
            height: `${layout.pageHeightMm}mm`,
            breakAfter: pageIndex === pages.length - 1 ? 'auto' : 'page',
            pageBreakAfter:
              pageIndex === pages.length - 1 ? 'auto' : 'always',
          }}
        >
          <div
            className="absolute grid"
            style={{
              top: `${layout.marginTopMm}mm`,
              left: `${layout.marginLeftMm}mm`,
              gridTemplateColumns: `repeat(${layout.columns}, ${layout.labelWidthMm}mm)`,
              gridAutoRows: `${layout.labelHeightMm}mm`,
              columnGap: `${layout.gapXMm}mm`,
              rowGap: `${layout.gapYMm}mm`,
            }}
          >
            {page.map((slot, slotIndex) =>
              slot.product ? (
                <LabelCell
                  key={`${pageIndex}-${slotIndex}`}
                  product={slot.product}
                  layout={layout}
                  shopName={shopName}
                  showShopName={showShopName}
                  showPrice={showPrice}
                  showMrp={showMrp}
                  note={note}
                />
              ) : (
                <div
                  key={`${pageIndex}-${slotIndex}`}
                  className="label-cell bg-white"
                  style={{
                    width: `${layout.labelWidthMm}mm`,
                    height: `${layout.labelHeightMm}mm`,
                  }}
                />
              ),
            )}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
