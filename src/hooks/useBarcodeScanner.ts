import { useEffect, useRef } from 'react';

export interface BarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxGapMs?: number;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
  );
}

export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: BarcodeScannerOptions = {},
): void {
  const { enabled = true, minLength = 4, maxGapMs = 90 } = options;
  const onScanRef = useRef(onScan);
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const resetBuffer = () => {
      bufferRef.current = '';
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };

    const scheduleReset = () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(resetBuffer, maxGapMs);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        resetBuffer();
        return;
      }

      if (event.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        resetBuffer();
        if (barcode.length >= minLength) {
          event.preventDefault();
          onScanRef.current(barcode);
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = performance.now();
      if (now - lastKeyAtRef.current > maxGapMs) {
        bufferRef.current = '';
      }
      lastKeyAtRef.current = now;
      bufferRef.current = `${bufferRef.current}${event.key}`.slice(0, 128);
      scheduleReset();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      resetBuffer();
    };
  }, [enabled, maxGapMs, minLength]);
}
