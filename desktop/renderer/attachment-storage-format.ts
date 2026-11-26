import type { Locale } from './i18n/index.js';

const storageUnits = [
  ['terabyte', 1_000_000_000_000],
  ['gigabyte', 1_000_000_000],
  ['megabyte', 1_000_000],
  ['kilobyte', 1_000],
] as const;

export function formatAttachmentStorage(bytes: number, locale: Locale): string {
  const [unit, scale] = storageUnits.find(([, threshold]) => bytes >= threshold) ?? ['byte', 1];
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 2,
    roundingMode: 'trunc',
  }).format(bytes / scale);
}
