import type { Product } from '../../types/pos';

export type LabelLayoutId = 'a4_65' | 'a4_40' | 'thermal_50x30';

export interface LabelLayout {
  id: LabelLayoutId;
  name: string;
  description: string;
  pageWidthMm: number;
  pageHeightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginLeftMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  gapXMm: number;
  gapYMm: number;
  thermal: boolean;
}

export const LABEL_LAYOUTS: Record<LabelLayoutId, LabelLayout> = {
  a4_65: {
    id: 'a4_65',
    name: 'A4 sheet - 65 labels',
    description: '5 x 13 stickers, 38 x 21 mm',
    pageWidthMm: 210,
    pageHeightMm: 297,
    columns: 5,
    rows: 13,
    marginTopMm: 10,
    marginLeftMm: 5,
    labelWidthMm: 38,
    labelHeightMm: 21,
    gapXMm: 2.5,
    gapYMm: 1,
    thermal: false,
  },
  a4_40: {
    id: 'a4_40',
    name: 'A4 sheet - 40 labels',
    description: '4 x 10 stickers, 48 x 25 mm',
    pageWidthMm: 210,
    pageHeightMm: 297,
    columns: 4,
    rows: 10,
    marginTopMm: 14,
    marginLeftMm: 6,
    labelWidthMm: 48,
    labelHeightMm: 25,
    gapXMm: 2,
    gapYMm: 2,
    thermal: false,
  },
  thermal_50x30: {
    id: 'thermal_50x30',
    name: 'Thermal roll - 50 x 30 mm',
    description: 'One label per page',
    pageWidthMm: 50,
    pageHeightMm: 30,
    columns: 1,
    rows: 1,
    marginTopMm: 0,
    marginLeftMm: 0,
    labelWidthMm: 50,
    labelHeightMm: 30,
    gapXMm: 0,
    gapYMm: 0,
    thermal: true,
  },
};

export const LABEL_LAYOUT_LIST = Object.values(LABEL_LAYOUTS);

export type LabelProduct = Pick<
  Product,
  | 'id'
  | 'name'
  | 'nameLocal'
  | 'skuCode'
  | 'barcode'
  | 'sellingPrice'
  | 'mrp'
  | 'unit'
>;

export interface LabelSelection {
  product: LabelProduct;
  copies: number;
}

export interface LabelSlot {
  product: LabelProduct | null;
  copyIndex: number | null;
}

export function layoutCapacity(layout: LabelLayout): number {
  return layout.columns * layout.rows;
}

export function selectionLabelCount(selections: LabelSelection[]): number {
  return selections.reduce(
    (total, selection) => total + Math.max(0, Math.trunc(selection.copies)),
    0,
  );
}

export function buildLabelPages(
  selections: LabelSelection[],
  layout: LabelLayout,
  skipCount: number,
): LabelSlot[][] {
  const capacity = layoutCapacity(layout);
  const skip = Math.max(0, Math.trunc(skipCount));
  const slots: LabelSlot[] = Array.from({ length: skip }, () => ({
    product: null,
    copyIndex: null,
  }));

  for (const selection of selections) {
    const copies = Math.max(0, Math.trunc(selection.copies));
    for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
      slots.push({ product: selection.product, copyIndex });
    }
  }

  const pages: LabelSlot[][] = [];
  for (let index = 0; index < slots.length; index += capacity) {
    pages.push(slots.slice(index, index + capacity));
  }
  return pages;
}
