import { ReceiptText } from 'lucide-react';
import { ModulePlaceholder } from './ModulePlaceholder';

export function InvoicesWarrantyView() {
  return (
    <ModulePlaceholder
      phase="Phase 4"
      title="Past Bills & Warranty Lookup"
      description="Find any bill by invoice number, customer phone, name or product serial/IMEI and check warranty status instantly."
      icon={ReceiptText}
      features={[
        'Search by invoice number, phone, name or serial/IMEI',
        'Live warranty status and expiry date',
        'Reprint and WhatsApp-share past bills',
        'Cancel or return a bill and restore stock',
        'Reverse udhaar on returns',
        'Duplicate bill and false warranty check',
      ]}
    />
  );
}
