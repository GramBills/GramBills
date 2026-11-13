import { BookUser } from 'lucide-react';
import { ModulePlaceholder } from './ModulePlaceholder';

export function KhataLedgerView() {
  return (
    <ModulePlaceholder
      phase="Phase 4"
      title="Customer Udhaar (Khata)"
      description="Village-wise credit ledger, payment collection and one-click WhatsApp reminders."
      icon={BookUser}
      features={[
        'Customer passbook with credit and payment history',
        'Village/area filter for market-day collection',
        'Record cash or UPI payments and update balances',
        'Credit-limit warnings',
        'One-click Hinglish WhatsApp reminders',
        'Outstanding udhaar totals for the shop',
      ]}
    />
  );
}
