import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Loader2 } from 'lucide-react';
import { Button, Modal } from '../../components/ui/primitives';

interface CameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function CameraScannerModal({
  open,
  onClose,
  onScan,
}: CameraScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let scanner: Html5Qrcode | null = null;
    let stopped = false;
    setError(null);
    setStarting(true);

    const start = async () => {
      try {
        scanner = new Html5Qrcode('grambill-camera-reader');
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (stopped) {
              return;
            }
            stopped = true;
            void scanner
              ?.stop()
              .catch(() => undefined)
              .finally(() => {
                scanner?.clear();
                onScanRef.current(decodedText);
                onCloseRef.current();
              });
          },
          () => undefined,
        );
      } catch (cameraError) {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Could not start the camera scanner.',
        );
      } finally {
        setStarting(false);
      }
    };

    void start();

    return () => {
      stopped = true;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => scanner?.clear());
      }
    };
  }, [open]);

  return (
    <Modal
      open={open}
      title="Camera barcode scanner"
      description="Use the phone or laptop camera when a USB scanner is not available."
      onClose={onClose}
      size="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close camera
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Camera className="h-4 w-4 text-slate-400" />
          Hold the barcode inside the camera frame.
        </div>
        {error ? (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {starting ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting camera...
          </div>
        ) : null}
        <div
          id="grambill-camera-reader"
          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950"
        />
      </div>
    </Modal>
  );
}
