import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import {
  createCustomer,
  findCustomerByPhone,
  normalizePhone,
  updateCustomer,
} from './customers';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
  db.close();
});

describe('customer service', () => {
  it('creates a customer with a normalized phone and zero balance', async () => {
    const customer = await createCustomer({
      name: ' Ramesh Patel ',
      phone: '+91 98765 43210',
      villageOrArea: ' Nandpur ',
    });

    expect(customer.name).toBe('Ramesh Patel');
    expect(customer.phone).toBe('9876543210');
    expect(customer.villageOrArea).toBe('Nandpur');
    expect(customer.currentUdhaarBalance).toBe(0);
    expect(customer.syncStatus).toBe('pending');
  });

  it('finds a customer by phone', async () => {
    const created = await createCustomer({
      name: 'Sunita Devi',
      phone: '9876543211',
    });

    const found = await findCustomerByPhone('+91 98765 43211');
    expect(found?.id).toBe(created.id);
  });

  it('rejects duplicate phone numbers', async () => {
    await createCustomer({ name: 'Imran Khan', phone: '9876543212' });
    await expect(
      createCustomer({ name: 'Another customer', phone: '9876543212' }),
    ).rejects.toThrow('already saved');
  });

  it('rejects changing a customer phone to another saved number', async () => {
    const first = await createCustomer({
      name: 'Lakshmi Bai',
      phone: '9876543213',
    });
    await createCustomer({ name: 'Ramesh Patel', phone: '9876543210' });

    await expect(
      updateCustomer(first.id, { phone: '9876543210' }),
    ).rejects.toThrow('already saved');
  });

  it('normalizes phone numbers to the last 10 digits', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });
});
