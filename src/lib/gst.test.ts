import { describe, expect, it } from 'vitest';
import {
  allocateProportionally,
  calculateInvoice,
  calculateLineTotals,
  roundToRupee,
} from './gst';

describe('GST calculations', () => {
  it('calculates exclusive GST', () => {
    const line = calculateLineTotals({
      quantity: 2,
      unitPrice: 100,
      gstRate: 18,
      taxInclusive: false,
    });

    expect(line.grossAmount).toBe(200);
    expect(line.taxableAmount).toBe(200);
    expect(line.taxAmount).toBe(36);
    expect(line.totalAmount).toBe(236);
  });

  it('extracts inclusive GST', () => {
    const line = calculateLineTotals({
      quantity: 1,
      unitPrice: 118,
      gstRate: 18,
      taxInclusive: true,
    });

    expect(line.taxableAmount).toBe(100);
    expect(line.taxAmount).toBe(18);
    expect(line.totalAmount).toBe(118);
  });

  it('applies item discount before tax', () => {
    const line = calculateLineTotals({
      quantity: 1,
      unitPrice: 100,
      discountAmount: 10,
      gstRate: 18,
      taxInclusive: false,
    });

    expect(line.netAmount).toBe(90);
    expect(line.taxAmount).toBe(16.2);
    expect(line.totalAmount).toBe(106.2);
  });

  it('allocates extra discount across lines by value', () => {
    const allocations = allocateProportionally(40, [100, 300]);
    expect(allocations).toEqual([10, 30]);
  });

  it('calculates invoice totals with extra discount and round off', () => {
    const result = calculateInvoice(
      [
        {
          quantity: 1,
          unitPrice: 99.6,
          gstRate: 0,
          taxInclusive: false,
        },
        {
          quantity: 1,
          unitPrice: 118,
          gstRate: 18,
          taxInclusive: true,
        },
      ],
      10,
    );

    expect(result.totals.subtotal).toBe(217.6);
    expect(result.totals.extraBillDiscount).toBe(10);
    expect(result.totals.rawGrandTotal).toBe(207.6);
    expect(result.totals.grandTotal).toBe(208);
    expect(result.totals.roundOff).toBe(0.4);
    expect(result.totals.cgstTotal + result.totals.sgstTotal).toBe(
      result.totals.taxAmount,
    );
  });

  it('caps extra discount at the net amount', () => {
    const result = calculateInvoice(
      [
        {
          quantity: 1,
          unitPrice: 100,
          gstRate: 0,
          taxInclusive: false,
        },
      ],
      250,
    );

    expect(result.totals.extraBillDiscount).toBe(100);
    expect(result.totals.grandTotal).toBe(0);
  });

  it('rounds to the nearest rupee', () => {
    expect(roundToRupee(99.4)).toBe(99);
    expect(roundToRupee(99.6)).toBe(100);
  });
});
