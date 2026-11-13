import { LOCAL_DEVICE_ID, LOCAL_SHOP_ID } from '../db/constants';
import { db } from '../db/database';
import { nowIso } from '../lib/date';
import { newId } from '../lib/id';
import type { Customer } from '../types/pos';

export interface CustomerInput {
  name: string;
  phone: string;
  villageOrArea?: string;
  gstin?: string;
  creditLimit?: number;
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

function cleanCustomerInput(input: CustomerInput): CustomerInput {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (name === '') {
    throw new Error('Customer name is required.');
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new Error('Enter a valid 10-digit customer phone number.');
  }
  return {
    name,
    phone,
    villageOrArea: input.villageOrArea?.trim() ?? '',
    gstin: input.gstin?.trim().toUpperCase() ?? '',
    creditLimit: Math.max(0, input.creditLimit ?? 0),
  };
}

export async function findCustomerByPhone(
  phone: string,
): Promise<Customer | undefined> {
  const normalized = normalizePhone(phone);
  if (normalized === '') {
    return undefined;
  }
  return db.customers.where('phone').equals(normalized).first();
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return db.customers.get(id);
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const cleaned = cleanCustomerInput(input);

  return db.transaction('rw', db.customers, async () => {
    const existing = await findCustomerByPhone(cleaned.phone);
    if (existing) {
      throw new Error(
        `Customer phone ${cleaned.phone} is already saved as ${existing.name}.`,
      );
    }

    const now = nowIso();
    const customer: Customer = {
      id: newId(),
      shopId: LOCAL_SHOP_ID,
      deviceId: LOCAL_DEVICE_ID,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
      name: cleaned.name,
      phone: cleaned.phone,
      villageOrArea: cleaned.villageOrArea ?? '',
      gstin: cleaned.gstin ?? '',
      currentUdhaarBalance: 0,
      creditLimit: cleaned.creditLimit ?? 0,
      totalPurchases: 0,
      lastVisitDate: now,
    };

    await db.customers.add(customer);
    return customer;
  });
}

export async function updateCustomer(
  id: string,
  patch: Partial<CustomerInput>,
): Promise<Customer> {
  return db.transaction('rw', db.customers, async () => {
    const current = await db.customers.get(id);
    if (!current) {
      throw new Error('Customer was not found.');
    }

    const nextName = patch.name?.trim() ?? current.name;
    const nextPhone =
      patch.phone === undefined
        ? current.phone
        : normalizePhone(patch.phone);
    if (nextName === '') {
      throw new Error('Customer name is required.');
    }
    if (!/^\d{10}$/.test(nextPhone)) {
      throw new Error('Enter a valid 10-digit customer phone number.');
    }
    if (nextPhone !== current.phone) {
      const duplicate = await findCustomerByPhone(nextPhone);
      if (duplicate && duplicate.id !== id) {
        throw new Error(
          `Customer phone ${nextPhone} is already saved as ${duplicate.name}.`,
        );
      }
    }

    const updated: Customer = {
      ...current,
      name: nextName,
      phone: nextPhone,
      villageOrArea:
        patch.villageOrArea === undefined
          ? current.villageOrArea
          : patch.villageOrArea.trim(),
      gstin:
        patch.gstin === undefined
          ? current.gstin
          : patch.gstin.trim().toUpperCase(),
      creditLimit:
        patch.creditLimit === undefined
          ? current.creditLimit
          : Math.max(0, patch.creditLimit),
      updatedAt: nowIso(),
      syncStatus: 'pending',
    };

    await db.customers.put(updated);
    return updated;
  });
}
