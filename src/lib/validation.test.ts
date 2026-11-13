import { describe, expect, it } from 'vitest';
import type { ShopSettingsForm } from '../types/pos';
import {
  isValidGstin,
  isValidPhone,
  isValidUpiId,
  validateShopForm,
} from './validation';

const validForm: ShopSettingsForm = {
  shopName: 'Shree Electronics',
  ownerName: 'Rakesh Kumar',
  phone: '9876500000',
  address: 'Main Market, Nandpur, Bhadohi, Uttar Pradesh',
  gstin: '09ABCDE1234F1Z5',
  upiId: 'shopowner@okaxis',
  upiPayeeName: 'Shree Electronics',
  invoicePrefix: 'INV-2026-',
  defaultPrintSize: 'thermal_80mm',
  termsAndConditions: 'Warranty as per manufacturer policy.',
};

describe('shop settings validation', () => {
  it('accepts a valid form', () => {
    expect(validateShopForm(validForm)).toEqual({});
  });

  it('validates phone, GSTIN and UPI identifiers', () => {
    expect(isValidPhone('9876500000')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidGstin('')).toBe(true);
    expect(isValidGstin('09abcde1234f1z5')).toBe(true);
    expect(isValidGstin('invalid')).toBe(false);
    expect(isValidUpiId('shop.owner-1@okaxis')).toBe(true);
    expect(isValidUpiId('shopowner')).toBe(false);
  });

  it('reports invalid required fields', () => {
    const errors = validateShopForm({
      ...validForm,
      shopName: 'A',
      ownerName: '',
      phone: '123',
      address: 'A',
      gstin: 'invalid',
      invoicePrefix: 'INV 2026',
    });
    expect(errors.shopName).toBeDefined();
    expect(errors.ownerName).toBeDefined();
    expect(errors.phone).toBeDefined();
    expect(errors.address).toBeDefined();
    expect(errors.gstin).toBeDefined();
    expect(errors.invoicePrefix).toBeDefined();
  });

  it('requires a payee name when a UPI ID is set', () => {
    const errors = validateShopForm({
      ...validForm,
      upiPayeeName: '',
    });
    expect(errors.upiPayeeName).toBeDefined();
  });

  it('rejects malformed UPI IDs', () => {
    const errors = validateShopForm({
      ...validForm,
      upiId: 'not-a-upi',
    });
    expect(errors.upiId).toBeDefined();
  });
});
