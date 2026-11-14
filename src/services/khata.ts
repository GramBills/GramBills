import { LOCAL_DEVICE_ID, LOCAL_SHOP_ID } from '../db/constants';
import { db } from '../db/database';
import { nowIso } from '../lib/date';
import { newId } from '../lib/id';
import { round2 } from '../lib/money';
import type {
  Customer,
  KhataPaymentMode,
  KhataTransaction,
} from '../types/pos';

export interface KhataPaymentInput {
  customerId: string;
  amount: number;
  paymentMode: Exclude<KhataPaymentMode, 'none'>;
  remarks?: string;
}

export interface KhataPaymentResult {
  customer: Customer;
  transaction: KhataTransaction;
}

export function calculateKhataBalance(
  transactions: KhataTransaction[],
): number {
  return round2(
    transactions.reduce((total, transaction) => {
      if (transaction.type === 'credit_given') {
        return total + transaction.amount;
      }
      if (
        transaction.type === 'payment_received' ||
        transaction.type === 'credit_reversed'
      ) {
        return total - transaction.amount;
      }
      return total;
    }, 0),
  );
}

export async function recordKhataPayment(
  input: KhataPaymentInput,
): Promise<KhataPaymentResult> {
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a payment amount greater than zero.');
  }
  if (input.paymentMode !== 'cash' && input.paymentMode !== 'upi') {
    throw new Error('Choose cash or UPI for the payment.');
  }

  return db.transaction(
    'rw',
    [db.customers, db.khataTransactions],
    async () => {
      const customer = await db.customers.get(input.customerId);
      if (!customer) {
        throw new Error('Customer was not found.');
      }
      if (customer.currentUdhaarBalance <= 0) {
        throw new Error('This customer has no outstanding udhaar.');
      }
      if (amount > round2(customer.currentUdhaarBalance + 0.01)) {
        throw new Error(
          `Payment cannot exceed the outstanding balance of ₹${customer.currentUdhaarBalance}.`,
        );
      }

      const now = nowIso();
      const nextBalance = round2(customer.currentUdhaarBalance - amount);
      const updatedCustomer: Customer = {
        ...customer,
        currentUdhaarBalance: nextBalance,
        updatedAt: now,
        syncStatus: 'pending',
      };
      const transaction: KhataTransaction = {
        id: newId(),
        shopId: LOCAL_SHOP_ID,
        deviceId: LOCAL_DEVICE_ID,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending',
        customerId: customer.id,
        invoiceId: null,
        type: 'payment_received',
        amount,
        paymentMode: input.paymentMode,
        balanceAfter: nextBalance,
        remarks:
          input.remarks?.trim() ||
          `Payment received by ${input.paymentMode === 'cash' ? 'cash' : 'UPI'}`,
      };

      await db.customers.put(updatedCustomer);
      await db.khataTransactions.add(transaction);
      return { customer: updatedCustomer, transaction };
    },
  );
}
