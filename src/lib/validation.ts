import type { PrintSize, ShopSettingsForm } from '../types/pos';

export type ShopFormErrors = Partial<Record<keyof ShopSettingsForm, string>>;

const PHONE_REGEX = /^[6-9]\d{9}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const INVOICE_PREFIX_REGEX = /^[A-Za-z0-9\-/]+$/;

const PRINT_SIZES: PrintSize[] = [
  'thermal_80mm',
  'thermal_58mm',
  'a4',
  'a5',
];

export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.trim());
}

export function isValidGstin(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized === '' || GSTIN_REGEX.test(normalized);
}

export function isValidUpiId(value: string): boolean {
  return UPI_REGEX.test(value.trim());
}

export function validateShopForm(form: ShopSettingsForm): ShopFormErrors {
  const errors: ShopFormErrors = {};

  if (form.shopName.trim().length < 2) {
    errors.shopName = 'Enter the shop name (at least 2 characters).';
  }
  if (form.ownerName.trim().length < 2) {
    errors.ownerName = 'Enter the owner name.';
  }
  if (!isValidPhone(form.phone)) {
    errors.phone = 'Enter a valid 10-digit Indian mobile number.';
  }
  if (form.address.trim().length < 5) {
    errors.address = 'Enter the shop address.';
  }
  if (!isValidGstin(form.gstin)) {
    errors.gstin = 'Enter a valid 15-character GSTIN or leave it blank.';
  }
  if (form.upiId.trim() !== '' && !isValidUpiId(form.upiId)) {
    errors.upiId = 'Enter a valid UPI ID like shop@okaxis.';
  }
  if (form.upiId.trim() !== '' && form.upiPayeeName.trim().length < 2) {
    errors.upiPayeeName = 'Enter the name shown in the UPI app.';
  }
  if (
    form.invoicePrefix.trim() === '' ||
    !INVOICE_PREFIX_REGEX.test(form.invoicePrefix.trim())
  ) {
    errors.invoicePrefix = 'Use letters, numbers, hyphens or slashes.';
  }
  if (!PRINT_SIZES.includes(form.defaultPrintSize)) {
    errors.defaultPrintSize = 'Choose a valid print size.';
  }

  return errors;
}
