import { BarChart3 } from 'lucide-react';
import { ModulePlaceholder } from '../../components/ModulePlaceholder';

export function ReportsDashboardView() {
  return (
    <ModulePlaceholder
      phase="Phase 4"
      title="Reports & Daily Profit"
      description="Daily galla closing, cash and UPI totals, net profit and a low-stock reorder sheet."
      icon={BarChart3}
      features={[
        'Today, yesterday, week, month and custom ranges',
        'Cash in drawer and UPI/bank received',
        'New udhaar given and collections',
        'Net realized profit and margin percentage',
        'Top selling products',
        'Low-stock reorder list for the wholesaler',
      ]}
    />
  );
}
