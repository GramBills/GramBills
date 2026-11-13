import { describe, expect, it } from 'vitest';
import {
  calcMarginPercent,
  calcProfit,
  formatINR,
  formatINR0,
  round2,
} from './money';

describe('money', () => {
  it('rounds to two decimals and handles invalid values', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('formats Indian rupee amounts', () => {
    expect(formatINR(1234.5)).toContain('1,234.50');
    expect(formatINR0(1234.5)).toContain('1,235');
    expect(formatINR(0)).toContain('0.00');
  });

  it('calculates profit and margin', () => {
    expect(calcProfit(100, 70)).toBe(30);
    expect(calcMarginPercent(100, 70)).toBe(30);
    expect(calcMarginPercent(0, 70)).toBe(0);
    expect(calcMarginPercent(Number.NaN, 70)).toBe(0);
  });
});
