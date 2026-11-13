import { QrCode } from 'lucide-react';
import type { ShopSettings } from '../../types/pos';
import { cn } from '../../lib/cn';
import { useUpiQrDataUrl } from './useUpiQrDataUrl';

interface UpiQrProps {
  settings: ShopSettings | undefined;
  amount: number;
  note?: string;
  size?: number;
  className?: string;
}

export function UpiQr({
  settings,
  amount,
  note = 'Bill payment',
  size = 180,
  className,
}: UpiQrProps) {
  const dataUrl = useUpiQrDataUrl(settings, amount, note);

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`UPI QR for ${amount}`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-center text-[11px] text-slate-400">
          <QrCode className="h-7 w-7" />
          <span>
            {amount > 0
              ? 'Add UPI ID in settings to show QR'
              : 'Enter UPI amount'}
          </span>
        </div>
      )}
    </div>
  );
}
