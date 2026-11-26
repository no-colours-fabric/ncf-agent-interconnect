import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAttachmentStorage } from '../desktop/renderer/attachment-storage-format.js';
import { attachmentMessages } from '../desktop/renderer/i18n/attachments.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';

test('attachment storage uses the largest full decimal unit and never rounds up across thresholds', () => {
  const cases = [
    [0, '0 byte'],
    [999, '999 byte'],
    [1_000, '1 kB'],
    [1_024, '1.02 kB'],
    [999_999, '999.99 kB'],
    [1_000_000, '1 MB'],
    [999_999_999, '999.99 MB'],
    [1_000_000_000, '1 GB'],
    [999_999_999_999, '999.99 GB'],
    [1_000_000_000_000, '1 TB'],
    [1_500_000_000_000, '1.5 TB'],
  ] as const;
  for (const [bytes, expected] of cases)
    assert.equal(formatAttachmentStorage(bytes, 'en'), expected, String(bytes));
});

test('each supported locale formats numbers and units in its own attachment storage row', () => {
  for (const locale of supportedLocales) {
    const { title, allAges, help } = attachmentMessages(locale);
    assert.ok(title && allAges && help, locale);
    for (const [bytes, value, unit] of [
      [15, 15, 'byte'],
      [1_500, 1.5, 'kilobyte'],
      [1_500_000, 1.5, 'megabyte'],
      [1_500_000_000, 1.5, 'gigabyte'],
      [1_500_000_000_000, 1.5, 'terabyte'],
    ] as const) {
      const expected = new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'short',
      }).format(value);
      assert.equal(formatAttachmentStorage(bytes, locale), expected, locale);
    }
  }
});
