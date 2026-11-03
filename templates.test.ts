/**
 * npx tsx --test templates.test.ts
 *
 * يحرس البذور ضدّ حالة لا تقبلها القاعدة. ظهرت هذه الحاجة بعد تشغيل
 * الويب فعليًّا: كانت فئتان بحدّ `null`، والقاعدة تسمح بواحدة فقط
 * (فهرس فريد جزئيّ)، فكانت البذرة تُنتج حالةً **لا يمكن حفظها**.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CURRENCIES, SITUATIONS, seedState } from './templates';
import type { IncomeShape } from './types';

const SHAPES: IncomeShape[] = [
  'fixed_salary',
  'variable',
  'allowance',
  'multiple',
  'none',
];

test('فئة واحدة فقط تأخذ المتبقّي — القاعدة تفرضها بفهرس فريد', () => {
  for (const shape of SHAPES) {
    const state = seedState(shape, 1250);
    const nulls = state.categories.filter(
      (c) => c.monthlyLimit === null && !c.archived,
    );
    assert.equal(nulls.length, 1, `${shape}: عددها ${nulls.length}`);
  }
});

test('كلّ وضع له بذرة، ومعرّفات الفئات فريدة', () => {
  for (const shape of SHAPES) {
    const state = seedState(shape, 1250);
    assert.ok(state.categories.length > 0, `${shape}: بلا فئات`);
    const ids = state.categories.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${shape}: معرّف مكرّر`);
    assert.equal(state.seededFrom, shape);
  }
});

test('كلّ فئة لها لون سليم وأيقونة', () => {
  for (const shape of SHAPES) {
    for (const c of seedState(shape, 1250).categories) {
      assert.match(c.color, /^#[0-9A-Fa-f]{6}$/, `${c.id}: لون`);
      assert.ok(c.icon.length > 4, `${c.id}: أيقونة`);
    }
  }
});

test('الحدود موجبة، والالتزامات تبدأ بصفر لا برقم مخترَع', () => {
  const state = seedState('fixed_salary', 1250);
  for (const c of state.categories) {
    if (c.monthlyLimit !== null) assert.ok(c.monthlyLimit > 0, `${c.id}`);
  }
  for (const c of state.commitments) assert.equal(c.amount, 0, c.id);
});

test('«من الصفر» بلا دخل ولا التزامات', () => {
  const state = seedState('none', 0);
  assert.deepEqual(state.income.sources, []);
  assert.deepEqual(state.commitments, []);
  assert.equal(state.categories.length, 1);
});

test('مصدر أساسيّ واحد على الأكثر — القاعدة تفرضه أيضًا', () => {
  for (const shape of SHAPES) {
    const primary = seedState(shape, 1250).income.sources.filter((s) => s.isPrimary);
    assert.ok(primary.length <= 1, `${shape}: ${primary.length}`);
  }
});

test('العملة تُحترم، والخانات تتبعها لا تتبع اللغة', () => {
  assert.equal(seedState('fixed_salary', 100, 'USD').income.currency.minorUnits, 2);
  assert.equal(seedState('fixed_salary', 100, 'KWD').income.currency.minorUnits, 3);
  // عملة مجهولة ترجع للأولى بدل أن ترمي
  assert.equal(seedState('fixed_salary', 100, 'XXX').income.currency.code, CURRENCIES[0].code);
});

test('كل وضع في SITUATIONS له بذرة تعمل', () => {
  for (const s of SITUATIONS) {
    assert.doesNotThrow(() => seedState(s.shape, 1250), s.shape);
  }
});
