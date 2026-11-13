import { describe, expect, it } from 'vitest';
import {
  buildLabelPages,
  LABEL_LAYOUTS,
  layoutCapacity,
  selectionLabelCount,
  type LabelProduct,
} from './labelLayouts';

const product: LabelProduct = {
  id: 'product-1',
  name: 'LED Bulb',
  nameLocal: '',
  skuCode: 'ELEC-1001',
  barcode: 'SKU0001001',
  sellingPrice: 110,
  mrp: 120,
  unit: 'pcs',
};

describe('label layouts', () => {
  it('defines the expected sticker capacities', () => {
    expect(layoutCapacity(LABEL_LAYOUTS.a4_65)).toBe(65);
    expect(layoutCapacity(LABEL_LAYOUTS.a4_40)).toBe(40);
    expect(layoutCapacity(LABEL_LAYOUTS.thermal_50x30)).toBe(1);
  });

  it('counts requested labels', () => {
    expect(
      selectionLabelCount([
        { product, copies: 2 },
        { product, copies: 3 },
      ]),
    ).toBe(5);
    expect(selectionLabelCount([{ product, copies: -4 }])).toBe(0);
  });

  it('respects skip positions on the first sheet', () => {
    const pages = buildLabelPages(
      [{ product, copies: 2 }],
      LABEL_LAYOUTS.a4_65,
      3,
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(5);
    expect(pages[0][0].product).toBeNull();
    expect(pages[0][1].product).toBeNull();
    expect(pages[0][2].product).toBeNull();
    expect(pages[0][3].product?.id).toBe(product.id);
    expect(pages[0][4].product?.id).toBe(product.id);
  });

  it('paginates labels across multiple sheets', () => {
    const pages = buildLabelPages(
      [{ product, copies: 66 }],
      LABEL_LAYOUTS.a4_65,
      0,
    );

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(65);
    expect(pages[1]).toHaveLength(1);
  });

  it('prints one thermal label per page and supports skip', () => {
    const pages = buildLabelPages(
      [{ product, copies: 2 }],
      LABEL_LAYOUTS.thermal_50x30,
      1,
    );

    expect(pages).toHaveLength(3);
    expect(pages[0][0].product).toBeNull();
    expect(pages[1][0].product?.id).toBe(product.id);
    expect(pages[2][0].product?.id).toBe(product.id);
  });
});
