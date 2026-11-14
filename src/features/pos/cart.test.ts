import { describe, expect, it } from 'vitest';
import {
  calculateCartLine,
  withPercentDiscount,
  type CartLine,
} from './cart';

function bulbLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    id: 'line-1',
    productId: 'product-1',
    name: 'Havells 9W LED Bulb',
    barcode: '8902670100011',
    unit: 'pcs',
    mrp: 120,
    unitPrice: 110,
    minSellingPrice: 90,
    purchasePrice: 62,
    gstRate: 12,
    taxInclusive: true,
    trackSerialImei: false,
    stockQty: 40,
    quantity: 1,
    discountAmount: 0,
    discountPercent: 0,
    serialOrImeiNumbers: [],
    warrantyMonths: 12,
    ...overrides,
  };
}

describe('cart percentage discount', () => {
  it('converts an item discount percentage into a rupee amount', () => {
    const discounted = withPercentDiscount(bulbLine({ quantity: 2 }), 10);

    expect(discounted.discountPercent).toBe(10);
    expect(discounted.discountAmount).toBe(22);
    expect(calculateCartLine(discounted).netAmount).toBe(198);
  });

  it('caps the discount percentage at 100', () => {
    const discounted = withPercentDiscount(bulbLine(), 150);

    expect(discounted.discountPercent).toBe(100);
    expect(discounted.discountAmount).toBe(110);
    expect(calculateCartLine(discounted).netAmount).toBe(0);
  });

  it('keeps the percentage when quantity changes', () => {
    const discounted = withPercentDiscount(bulbLine(), 10);
    const withMoreQty = withPercentDiscount(
      { ...discounted, quantity: 3 },
      discounted.discountPercent,
    );

    expect(withMoreQty.discountPercent).toBe(10);
    expect(withMoreQty.discountAmount).toBe(33);
  });
});
