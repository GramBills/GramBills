import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { seedInitialData } from '../db/seed';
import {
  calculateKhataBalance,
  recordKhataPayment,
} from './khata';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedInitialData(db);
});

afterAll(async () => {
  await db.delete();
  db.close();
});

describe('khata service', () => {
  it('records a payment and reconciles the passbook balance', async () => {
    const customer = await db.customers.where('phone').equals('9876543210').first();
    expect(customer?.currentUdhaarBalance).toBe(1250);

    const result = await recordKhataPayment({
      customerId: customer!.id,
      amount: 500,
      paymentMode: 'cash',
      remarks: 'Collected at shop',
    });

    expect(result.customer.currentUdhaarBalance).toBe(750);
    expect(result.transaction.type).toBe('payment_received');
    expect(result.transaction.paymentMode).toBe('cash');
    expect(result.transaction.balanceAfter).toBe(750);

    const transactions = await db.khataTransactions
      .where('customerId')
      .equals(customer!.id)
      .toArray();
    expect(calculateKhataBalance(transactions)).toBe(750);
  });

  it('rejects payments above the outstanding balance', async () => {
    const customer = await db.customers.where('phone').equals('9876543212').first();
    await expect(
      recordKhataPayment({
        customerId: customer!.id,
        amount: customer!.currentUdhaarBalance + 1,
        paymentMode: 'upi',
      }),
    ).rejects.toThrow('cannot exceed');
  });

  it('rejects payments when there is no outstanding udhaar', async () => {
    const customer = await db.customers.where('phone').equals('9876543211').first();
    await expect(
      recordKhataPayment({
        customerId: customer!.id,
        amount: 100,
        paymentMode: 'cash',
      }),
    ).rejects.toThrow('no outstanding udhaar');
  });
});
