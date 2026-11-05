import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountToMinor, minorUnitsFor, normalizeDigits, ISO_DEFAULT_MINOR_UNITS } from './parse-amount.ts';

test('الدينار ثلاث خزائن، والدولار اثنتان، والين صفر', () => {
  assert.equal(minorUnitsFor('KWD'), 3);
  assert.equal(minorUnitsFor('kwd'), 3);
  assert.equal(minorUnitsFor(' BHD '), 3);
  assert.equal(minorUnitsFor('USD'), 2);
  assert.equal(minorUnitsFor('JPY'), 0);
  assert.equal(minorUnitsFor('ZZZ'), ISO_DEFAULT_MINOR_UNITS);
});

test('الأرقام العربيّة والفارسيّة تُوحَّد', () => {
  assert.equal(normalizeDigits('١٢٫٧٥٠'), '12٫750');
  assert.equal(normalizeDigits('۱۲۳'), '123');
  assert.equal(normalizeDigits('12.750'), '12.750');
});

test('الفاتورة الكويتيّة بالأرقام اللاتينيّة والعربيّة سواء', () => {
  assert.equal(parseAmountToMinor('12.750', 'KWD'), 12750);
  assert.equal(parseAmountToMinor('١٢٫٧٥٠', 'KWD'), 12750);
  assert.equal(parseAmountToMinor('12.750 د.ك', 'KWD'), 12750);
  assert.equal(parseAmountToMinor('KD 12.750', 'KWD'), 12750);
});

test('فاصلة الآلاف لا تُحسب جزءًا من الكسر', () => {
  assert.equal(parseAmountToMinor('1,234.750', 'KWD'), 1234750);
  assert.equal(parseAmountToMinor('1,250', 'USD'), 125000);
  assert.equal(parseAmountToMinor('12.50', 'USD'), 1250);
  assert.equal(parseAmountToMinor('1.234,56', 'EUR'), 123456);
});

test('الكسر الناقص يُكمَّل يمينًا لا يسارًا', () => {
  // 12.5 ديناراً هي 12.500 لا 12.005 — الخطأ هنا يُنقص المبلغ مئة ضعف.
  assert.equal(parseAmountToMinor('12.5', 'KWD'), 12500);
  assert.equal(parseAmountToMinor('12.7', 'USD'), 1270);
});

test('الين لا كسر له', () => {
  assert.equal(parseAmountToMinor('1250', 'JPY'), 1250);
  assert.equal(parseAmountToMinor('1,250', 'JPY'), 1250);
});

test('بلا فاصلةٍ أصلًا: عددٌ صحيح من الوحدات الكبرى', () => {
  assert.equal(parseAmountToMinor('12', 'KWD'), 12000);
  assert.equal(parseAmountToMinor('12', 'USD'), 1200);
});

test('الملتبس يُرفض ولا يُخمَّن', () => {
  // ثلاثة أرقامٍ بعد نقطةٍ في عملةٍ ذات خزانتين: 12.75 أم 12,750؟
  assert.equal(parseAmountToMinor('12.750', 'USD'), null);
  assert.equal(parseAmountToMinor('1.2345', 'KWD'), null);
  assert.equal(parseAmountToMinor('', 'KWD'), null);
  assert.equal(parseAmountToMinor('المجموع', 'KWD'), null);
  // @ts-expect-error اختبارُ مدخلٍ ليس نصًّا
  assert.equal(parseAmountToMinor(12.75, 'KWD'), null);
});

test('الفاصلة العربيّة العشريّة تخالف فاصلة الآلاف العربيّة', () => {
  // ٫ عشريّة، ٬ للآلاف. لو خُلطتا صار ١٢٫٧٥٠ اثني عشر ألفًا.
  assert.equal(parseAmountToMinor('١٢٬٣٤٥٫٦٧٨', 'KWD'), 12345678);
  assert.equal(parseAmountToMinor('١٢٫٧٥٠', 'KWD'), 12750);
});

test('المسافات والفواصل العلويّة تسقط', () => {
  assert.equal(parseAmountToMinor('1 234.750', 'KWD'), 1234750);
  assert.equal(parseAmountToMinor("1'234.56", 'CHF'), 123456);
});

test('المبالغ السخيفة تُرفض', () => {
  assert.equal(parseAmountToMinor('9'.repeat(40), 'KWD'), null);
});
