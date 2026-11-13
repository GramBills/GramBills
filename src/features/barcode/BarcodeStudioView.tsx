import { Barcode } from 'lucide-react';
import { ModulePlaceholder } from '../../components/ModulePlaceholder';

export function BarcodeStudioView() {
  return (
    <ModulePlaceholder
      phase="Phase 2"
      title="Free Barcode & Label Studio"
      description="Generate CODE128 barcodes for loose and local items and print them on ordinary A4 sticker sheets or thermal labels."
      icon={Barcode}
      features={[
        'One-click barcode generation for unbarcoded items',
        '65-up and 40-up A4 sticker sheet layouts',
        'Thermal label roll layout',
        'Skip used sticker positions to save partial sheets',
        'Shop name, product name, MRP and price on each label',
        'Print-ready millimeter-based layout',
      ]}
    />
  );
}
