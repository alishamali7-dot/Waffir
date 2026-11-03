/**
 * npx tsx --test budget.test.ts
 *
 * حدود حالات الفئة. الحدّ الأوسط (spent === limit) ظهر عيبًا عند
 * تشغيل الويب: كان يُعرض «اقترب من الحدّ» مع «المتبقّي ٠٫٠٠٠».
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeBudget, incomeFor, monthKeyOf, daysInMonth } from './budget';
import { seedState } from './templates';
import { toFils, type AppState, type Transaction } from './types';

const MONTH = '2026-11';

function stateWith(spentOnFood: number): AppState {
  const base = seedState('fixed_salary', 1000, 'KWD', 1);
  const tx: Transaction[] = spentOnFood
    ? [
        {
          id: 't1',
          occurredAt: `${MONTH}-05T10:00:00.000Z`,
          amount: toFils(spentOnFood),
          direction: 'debit',
          description: 'بقالة',
          categoryId: 'food',
          accountId: 'card',
          source: 'manual',
          needsReview: false,
          dedupeKey: 'k1',
        },
      ]
    : [];
  return { ...base, transactions: tx };
}

const foodOf = (s: AppState) =>
  computeBudget(s, MONTH).categories.find((c) => c.categoryId === 'food')!;

test('تحت الحدّ: في الحدّ', () => {
  const c = foodOf(stateWith(10));
  assert.equal(c.state, 'ok');
  assert.ok(c.remaining > 0);
});

test('عند ٨٥٪: اقترب', () => {
  const limit = seedState('fixed_salary', 1000).categories.find((c) => c.id === 'food')!
    .monthlyLimit!;
  const c = foodOf(stateWith((limit * 0.9) / 1000));
  assert.equal(c.state, 'near');
});

test('البلوغ تمامًا يُعدّ تجاوزًا — لا «اقترب» مع متبقٍّ صفر', () => {
  const limit = seedState('fixed_salary', 1000).categories.find((c) => c.id === 'food')!
    .monthlyLimit!;
  const c = foodOf(stateWith(limit / 1000));
  assert.equal(c.state, 'over');
  assert.equal(c.remaining, 0);
});

test('فوق الحدّ: تجاوز بمقدار موجب', () => {
  const limit = seedState('fixed_salary', 1000).categories.find((c) => c.id === 'food')!
    .monthlyLimit!;
  const c = foodOf(stateWith(limit / 1000 + 5));
  assert.equal(c.state, 'over');
  assert.equal(c.remaining, -toFils(5));
});

test('التحويل بين حسابين لا يُحسب صرفًا', () => {
  const base = stateWith(0);
  const withTransfer: AppState = {
    ...base,
    transactions: [
      {
        id: 'tr',
        occurredAt: `${MONTH}-05T10:00:00.000Z`,
        amount: toFils(100),
        direction: 'debit',
        description: 'إلى الادِّخار',
        categoryId: 'food',
        accountId: 'card',
        transferToAccountId: 'savings',
        source: 'manual',
        needsReview: false,
        dedupeKey: 'k2',
      },
    ],
  };
  assert.equal(computeBudget(withTransfer, MONTH).spentTotal, 0);
});

test('الدخل: مجموع المصادر المعتادة، والتعديل يتقدّم عليها', () => {
  const base = seedState('fixed_salary', 1000, 'KWD', 1);
  assert.equal(incomeFor(base, MONTH), toFils(1000));

  const overridden: AppState = {
    ...base,
    incomeOverrides: {
      [MONTH]: { month: MONTH, actualSalary: toFils(1200), extras: [] },
    },
  };
  assert.equal(incomeFor(overridden, MONTH), toFils(1200));
  // شهر آخر لا يتأثّر
  assert.equal(incomeFor(overridden, '2026-10'), toFils(1000));
});

test('مصدر بلا مبلغ معتاد لا يُبنى عليه حدّ', () => {
  const s = seedState('variable', 800);
  // الدخل المتغيّر: المصدر له مبلغ معتاد، لكنّ يومه غير محدّد
  assert.equal(s.income.sources[0].payDayOfMonth, undefined);
  assert.ok(incomeFor(s, MONTH) > 0);
});

test('أيام الشهر تتبع التقويم لا الـ٣٠', () => {
  assert.equal(daysInMonth('2026-02'), 28);
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(daysInMonth('2026-11'), 30);
  assert.equal(daysInMonth('2026-12'), 31);
});

test('monthKeyOf يبطّن الشهر بصفر', () => {
  assert.equal(monthKeyOf(new Date(2026, 0, 15)), '2026-01');
  assert.equal(monthKeyOf(new Date(2026, 10, 3)), '2026-11');
});
