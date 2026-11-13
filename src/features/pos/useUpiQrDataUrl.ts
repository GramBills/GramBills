import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { ShopSettings } from '../../types/pos';
import { buildUpiUri } from '../../lib/upi';

export function useUpiQrDataUrl(
  settings: ShopSettings | undefined,
  amount: number,
  note: string,
): string {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    const upiId = settings?.upiId.trim() ?? '';
    const payee = settings?.upiPayeeName.trim() ?? '';
    if (!upiId || !payee || amount <= 0) {
      setDataUrl('');
      return;
    }

    const uri = buildUpiUri({
      pa: upiId,
      pn: payee,
      am: amount,
      tn: note,
    });

    QRCode.toDataURL(uri, {
      width: 320,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setDataUrl('');
        }
      });

    return () => {
      active = false;
    };
  }, [settings, amount, note]);

  return dataUrl;
}

