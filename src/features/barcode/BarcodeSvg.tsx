import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { cn } from '../../lib/cn';

interface BarcodeSvgProps {
  value: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
  className?: string;
}

export function BarcodeSvg({
  value,
  height = 46,
  width = 1.7,
  displayValue = false,
  className,
}: BarcodeSvgProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    if (value.trim() === '') {
      svg.innerHTML = '';
      return;
    }
    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        margin: 0,
        lineColor: '#000000',
        background: 'transparent',
        font: 'monospace',
        fontSize: 11,
        textMargin: 1,
      });
    } catch {
      svg.innerHTML = '';
    }
  }, [displayValue, height, value, width]);

  return (
    <svg
      ref={svgRef}
      className={cn('block h-auto w-full', className)}
      role="img"
      aria-label={value ? `Barcode ${value}` : 'Barcode missing'}
    />
  );
}
