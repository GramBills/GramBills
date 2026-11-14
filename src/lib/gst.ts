import type { InvoiceType } from '../types/pos';
import { round2 } from './money';

export interface GstLineInput {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  gstRate: number;
  taxInclusive: boolean;
}

export interface GstLineTotals {
  grossAmount: number;
  itemDiscountAmount: number;
  extraDiscountAmount: number;
  netAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface GstInvoiceTotals {
  subtotal: number;
  itemDiscountTotal: number;
  extraBillDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  rawGrandTotal: number;
  roundOff: number;
  grandTotal: number;
}

export interface GstInvoiceCalculation {
  lines: GstLineTotals[];
  totals: GstInvoiceTotals;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function roundToRupee(value: number): number {
  return Math.round(safeNumber(value));
}

export function allocateProportionally(
  total: number,
  weights: number[],
): number[] {
  const safeTotal = round2(Math.max(0, safeNumber(total)));
  const safeWeights = weights.map((weight) => Math.max(0, safeNumber(weight)));
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0);

  if (safeTotal === 0 || totalWeight === 0) {
    return safeWeights.map(() => 0);
  }

  const cappedTotal = Math.min(safeTotal, round2(totalWeight));
  const allocations = safeWeights.map((weight) =>
    round2((cappedTotal * weight) / totalWeight),
  );
  const allocated = round2(
    allocations.reduce((sum, amount) => sum + amount, 0),
  );
  const difference = round2(cappedTotal - allocated);

  if (difference !== 0) {
    let largestIndex = 0;
    for (let index = 1; index < safeWeights.length; index += 1) {
      if (safeWeights[index] > safeWeights[largestIndex]) {
        largestIndex = index;
      }
    }
    allocations[largestIndex] = round2(
      allocations[largestIndex] + difference,
    );
  }

  return allocations;
}

export function calculateLineTotals(
  line: GstLineInput,
  extraDiscountAmount = 0,
  invoiceType: InvoiceType = 'gst_tax_invoice',
): GstLineTotals {
  const quantity = Math.max(0, safeNumber(line.quantity));
  const unitPrice = Math.max(0, safeNumber(line.unitPrice));
  const grossAmount = round2(quantity * unitPrice);
  const itemDiscountAmount = round2(
    Math.min(grossAmount, Math.max(0, safeNumber(line.discountAmount ?? 0))),
  );
  const netBeforeExtra = round2(grossAmount - itemDiscountAmount);
  const extraDiscount = round2(
    Math.min(netBeforeExtra, Math.max(0, safeNumber(extraDiscountAmount))),
  );
  const netAmount = round2(netBeforeExtra - extraDiscount);
  const rate = Math.max(0, safeNumber(line.gstRate)) / 100;

  let taxableAmount: number;
  let taxAmount: number;
  let totalAmount: number;

  if (invoiceType !== 'gst_tax_invoice') {
    taxableAmount = netAmount;
    taxAmount = 0;
    totalAmount = netAmount;
  } else if (line.taxInclusive) {
    taxableAmount = rate > 0 ? round2(netAmount / (1 + rate)) : netAmount;
    taxAmount = round2(netAmount - taxableAmount);
    totalAmount = netAmount;
  } else {
    taxableAmount = netAmount;
    taxAmount = round2(netAmount * rate);
    totalAmount = round2(taxableAmount + taxAmount);
  }

  return {
    grossAmount,
    itemDiscountAmount,
    extraDiscountAmount: extraDiscount,
    netAmount,
    taxableAmount,
    taxAmount,
    totalAmount,
  };
}

export function calculateInvoice(
  lines: GstLineInput[],
  extraBillDiscount = 0,
  invoiceType: InvoiceType = 'gst_tax_invoice',
): GstInvoiceCalculation {
  const safeLines = lines.map((line) => {
    const quantity = Math.max(0, safeNumber(line.quantity));
    const unitPrice = Math.max(0, safeNumber(line.unitPrice));
    const grossAmount = round2(quantity * unitPrice);
    const itemDiscountAmount = round2(
      Math.min(
        grossAmount,
        Math.max(0, safeNumber(line.discountAmount ?? 0)),
      ),
    );
    return {
      input: line,
      grossAmount,
      itemDiscountAmount,
      netBeforeExtra: round2(grossAmount - itemDiscountAmount),
    };
  });

  const netTotal = round2(
    safeLines.reduce((sum, line) => sum + line.netBeforeExtra, 0),
  );
  const appliedExtraDiscount = round2(
    Math.min(netTotal, Math.max(0, safeNumber(extraBillDiscount))),
  );
  const extraAllocations = allocateProportionally(
    appliedExtraDiscount,
    safeLines.map((line) => line.netBeforeExtra),
  );

  const calculatedLines = safeLines.map((line, index) =>
    calculateLineTotals(line.input, extraAllocations[index], invoiceType),
  );

  const subtotal = round2(
    calculatedLines.reduce((sum, line) => sum + line.grossAmount, 0),
  );
  const itemDiscountTotal = round2(
    calculatedLines.reduce((sum, line) => sum + line.itemDiscountAmount, 0),
  );
  const taxableAmount = round2(
    calculatedLines.reduce((sum, line) => sum + line.taxableAmount, 0),
  );
  const taxAmount = round2(
    calculatedLines.reduce((sum, line) => sum + line.taxAmount, 0),
  );
  const rawGrandTotal = round2(
    calculatedLines.reduce((sum, line) => sum + line.totalAmount, 0),
  );
  const grandTotal = roundToRupee(rawGrandTotal);
  const cgstTotal = round2(taxAmount / 2);
  const sgstTotal = round2(taxAmount - cgstTotal);

  return {
    lines: calculatedLines,
    totals: {
      subtotal,
      itemDiscountTotal,
      extraBillDiscount: appliedExtraDiscount,
      taxableAmount,
      taxAmount,
      cgstTotal,
      sgstTotal,
      rawGrandTotal,
      roundOff: round2(grandTotal - rawGrandTotal),
      grandTotal,
    },
  };
}
