export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatINR(
  value: number,
  options: { decimals?: number } = {},
): string {
  const decimals = options.decimals ?? 2;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(round2(value));
}

export function formatINR0(value: number): string {
  return formatINR(value, { decimals: 0 });
}

export function calcProfit(sellingPrice: number, purchasePrice: number): number {
  return round2(sellingPrice - purchasePrice);
}

export function calcMarginPercent(
  sellingPrice: number,
  purchasePrice: number,
): number {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    return 0;
  }
  return round2(((sellingPrice - purchasePrice) / sellingPrice) * 100);
}


const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitWords(value: number): string {
  if (value < 20) {
    return ONES[value];
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${TENS[tens]}${ones > 0 ? ` ${ONES[ones]}` : ''}`;
}

function numberToIndianWords(value: number): string {
  const number = Math.max(0, Math.trunc(value));
  if (number === 0) {
    return 'Zero';
  }

  const crore = Math.floor(number / 10_000_000);
  const lakh = Math.floor((number % 10_000_000) / 100_000);
  const thousand = Math.floor((number % 100_000) / 1_000);
  const hundred = Math.floor((number % 1_000) / 100);
  const rest = number % 100;
  const parts: string[] = [];

  if (crore > 0) {
    parts.push(`${numberToIndianWords(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${twoDigitWords(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${twoDigitWords(thousand)} Thousand`);
  }
  if (hundred > 0) {
    parts.push(`${ONES[hundred]} Hundred`);
  }
  if (rest > 0) {
    parts.push(twoDigitWords(rest));
  }

  return parts.join(' ');
}

export function formatINRInWords(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.abs(value) : 0;
  const roundedValue = Math.round(safeValue * 100) / 100;
  const rupees = Math.floor(roundedValue);
  const paise = Math.round((roundedValue - rupees) * 100);
  const rupeeWords = `${numberToIndianWords(rupees)} ${
    rupees === 1 ? 'Rupee' : 'Rupees'
  }`;
  const paiseWords =
    paise > 0
      ? ` and ${twoDigitWords(paise)} Paise`
      : '';
  return `${rupeeWords}${paiseWords} Only`;
}
