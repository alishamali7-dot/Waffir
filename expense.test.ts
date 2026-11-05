import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeBudget } from './budget';
import { amountMinorOf, buildExpenseRow, limitNoteOf, occurredAtOf } from './expense';
import { seedState } from './templates';

const today = '2026-11-05';
const good = {
  amount: '3.500', categoryId: 'cat', accountId: 'acc', date: today,
  note: '  غداء  ', rawText: 'غداء 3.5', key: 'k1',
};

test('المبلغ: الأرقام العربية وخانات العملة', () => {
  assert.equal(amountMinorOf('٣٫٥٠٠', 'KWD'), 3500);
  assert.equal(amountMinorOf('3.5', 'USD'), 350);
  assert.equal(amountMinorOf('1,250', 'USD'), 125000);
});

test('المبلغ: الصفر والملتبس والفراغ يُرفضون', () => {
  assert.equal(amountMinorOf('0', 'KWD'), null);
  assert.equal(amountMinorOf('', 'KWD'), null);
  assert.equal(amountMinorOf('abc', 'KWD'), null);
  assert.equal(amountMinorOf('12.750', 'USD'), null);
});

test('الصفّ: مصروف يدويّ يطابق قيود القاعدة', () => {
  const { row, error } = buildExpenseRow(good, 'KWD', today);
  assert.equal(error, undefined);
  assert.equal(row!.amount, 3500);
  assert.equal(row!.kind, 'expense');
  assert.equal(row!.source, 'manual');
  assert.equal(row!.description, 'غداء');
  assert.equal(row!.raw_text, 'غداء 3.5');
  assert.equal(row!.dedupe_key, 'k1');
  assert.equal('to_account_id' in row!, false);
});

test('الصفّ: المدخلات السيئة ترجع سببها', () => {
  assert.equal(buildExpenseRow({ ...good, amount: '0' }, 'KWD', today).error, 'amount');
  assert.equal(buildExpenseRow({ ...good, date: '2026-02-31' }, 'KWD', today).error, 'date');
  assert.equal(buildExpenseRow({ ...good, date: 'امس' }, 'KWD', today).error, 'date');
  assert.equal(buildExpenseRow({ ...good, date: '2026-11-09' }, 'KWD', today).error, 'date');
  assert.equal(buildExpenseRow({ ...good, date: '2024-01-01' }, 'KWD', today).error, 'date');
  assert.equal(buildExpenseRow({ ...good, categoryId: '' }, 'KWD', today).error, 'save');
  assert.equal(buildExpenseRow({ ...good, key: '' }, 'KWD', today).error, 'save');
});

test('غدٌ مقبول: الكويت تسبق توقيت السيرفر بثلاث ساعات', () => {
  assert.equal(buildExpenseRow({ ...good, date: '2026-11-06' }, 'KWD', today).error, undefined);
});

test('أوّل الشهر يبقى في شهره في كلّ منطقة زمنيّة', () => {
  const stored = occurredAtOf('2026-11-01');
  assert.ok(stored.startsWith('2026-11'));

  const base = seedState('fixed_salary', 1000);
  const food = base.categories.find((c) => c.id === 'food')!;
  const state = {
    ...base,
    transactions: [{
      id: 't', occurredAt: stored, amount: 1000, direction: 'debit' as const,
      description: '', categoryId: food.id, accountId: 'card',
      source: 'manual' as const, needsReview: false, dedupeKey: 't',
    }],
  };
  const spentIn = (month: string) =>
    computeBudget(state, month).categories.find((c) => c.categoryId === food.id)!.spent;
  assert.equal(spentIn('2026-11'), 1000);
  assert.equal(spentIn('2026-10'), 0);
});

test('حدّ الفئة: يبقى، يقترب، يتجاوز', () => {
  assert.deepEqual(limitNoteOf({ limit: 1000, spent: 100 }, 200, 0.85), { kind: 'ok', amount: 700 });
  assert.deepEqual(limitNoteOf({ limit: 1000, spent: 700 }, 200, 0.85), { kind: 'low', amount: 100 });
  assert.deepEqual(limitNoteOf({ limit: 1000, spent: 900 }, 300, 0.85), { kind: 'over', amount: 200 });
  // بلوغ الحدّ تمامًا: لا تجاوز، ويبقى صفر
  assert.deepEqual(limitNoteOf({ limit: 1000, spent: 500 }, 500, 0.85), { kind: 'low', amount: 0 });
});

test('بلا حدّ لا تنبيه', () => {
  assert.equal(limitNoteOf({ limit: 0, spent: 0 }, 500, 0.85), null);
});
