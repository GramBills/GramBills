import { Package } from 'lucide-react';
import { ModulePlaceholder } from '../../components/ModulePlaceholder';

export function InventoryView() {
  return (
    <ModulePlaceholder
      phase="Phase 2"
      title="Inventory & Stock"
      description="Product catalog, floor-price guardrails, stock-in entries, CSV import and low-stock filters."
      icon={Package}
      features={[
        'Add and edit products with Hindi/local names',
        'Minimum selling price and live margin calculation',
        'Quick stock-in purchase entry with movement history',
        'CSV import, export and sample template',
        'Low-stock and unbarcoded product filters',
        'Serial/IMEI and warranty defaults per product',
      ]}
    />
  );
}
