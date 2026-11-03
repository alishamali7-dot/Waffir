/**
 * npx tsx --test sync/plan.test.ts
 *
 * يختبر قرارات المزامنة وحدها. لا شبكة ولا SQLite — لأن الأخطاء
 * المؤلمة في المزامنة كلها في هذي القرارات، لا في استدعاء الـ API.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TABLE_ORDER,
  chunk,
  compareTimestamps,
  forPush,
  nextCursor,
  resolve,
  type LocalRow,
} from './plan';

const row = (id: string, updated_at: string): LocalRow => ({
  id,
  updated_at,
  _dirty: 0,
});

// ─── المؤشّر ─────────────────────────────────────────────────────────

test('المؤشّر = أكبر updated_at في الصفوف', () => {
  const rows = [
    row('a', '2026-11-03T10:00:00.000000+00:00'),
    row('b', '2026-11-03T12:00:00.000000+00:00'),
    row('c', '2026-11-03T11:00:00.000000+00:00'),
  ];
  assert.equal(nextCursor(rows, null), '2026-11-03T12:00:00.000000+00:00');
});

test('صفر صفوف لا يحرّك المؤشّر', () => {
  const cur = '2026-11-03T12:00:00.000000+00:00';
  assert.equal(nextCursor([], cur), cur);
});

test('المؤشّر لا يرجع للخلف', () => {
  const cur = '2026-11-03T12:00:00.000000+00:00';
  const rows = [row('a', '2026-11-01T08:00:00.000000+00:00')];
  assert.equal(nextCursor(rows, cur), cur);
});

test('المؤشّر يُرجَع نصًّا كما جاء — بلا تحويل لـ Date', () => {
  // الميكروثانية تضيع لو حوّلناه، فيفوّت صفًّا كُتب في نفس الميلي
  const exact = '2026-11-03T12:00:00.123456+00:00';
  assert.equal(nextCursor([row('a', exact)], null), exact);
});

test('updated_at فاضي يُتجاهل ولا يفسد المؤشّر', () => {
  const rows = [
    { id: 'a', updated_at: '', _dirty: 0 } as LocalRow,
    row('b', '2026-11-03T09:00:00.000000+00:00'),
  ];
  assert.equal(nextCursor(rows, null), '2026-11-03T09:00:00.000000+00:00');
});

// ─── مقارنة الطوابع الزمنية ──────────────────────────────────────────

test('الكسر العشري المتغيّر الطول: المقارنة النصية الساذجة تفشل هنا', () => {
  const half = '2026-11-03T12:00:00.5+00:00';       // ٥٠٠ ميلي
  const micro = '2026-11-03T12:00:00.123456+00:00'; // ١٢٣ ميلي

  // لو قارنّا نصًّا مباشرة: ".5" > ".1" فيطلع half أكبر — وهذا صح زمنيًّا
  // لكن العكس هو الفخ: ".09" < ".1" نصًّا وزمنيًّا، بينما ".2" > ".19"
  // زمنيًّا و ".19" > ".2"... لا، نصًّا ".2" > ".19". نثبّت الحالة:
  assert.ok(compareTimestamps(half, micro) > 0);

  const a = '2026-11-03T12:00:00.09+00:00';  // ٩٠ ميلي
  const b = '2026-11-03T12:00:00.1+00:00';   // ١٠٠ ميلي
  assert.ok(compareTimestamps(a, b) < 0, 'ـ٠٩. أصغر من ـ١.');
  assert.ok('2026-11-03T12:00:00.09+00:00' < '2026-11-03T12:00:00.1+00:00');

  // الفخ الحقيقي: ٢ أكبر من ١٩ نصًّا، وزمنيًّا ٢٠٠ > ١٩٠ — متوافق.
  // والفخ المعاكس: ٩ مقابل ١٠.
  const c = '2026-11-03T12:00:00.9+00:00';   // ٩٠٠ ميلي
  const d = '2026-11-03T12:00:00.10+00:00';  // ١٠٠ ميلي
  assert.ok(compareTimestamps(c, d) > 0, 'ـ٩. أكبر من ـ١٠.');
  // النصّ الساذج يقلبها:
  assert.ok('2026-11-03T12:00:00.9+00:00' > '2026-11-03T12:00:00.10+00:00');
});

test('بلا كسر عشري أصغر من أي كسر في نفس الثانية', () => {
  const none = '2026-11-03T12:00:00+00:00';
  const some = '2026-11-03T12:00:00.000001+00:00';
  assert.ok(compareTimestamps(none, some) < 0);
});

test('Z و +00:00 نفس اللحظة', () => {
  assert.equal(
    compareTimestamps('2026-11-03T12:00:00.5Z', '2026-11-03T12:00:00.5+00:00'),
    0,
  );
});

test('المؤشّر يصحّ مع كسور مختلفة الطول', () => {
  const rows = [
    row('a', '2026-11-03T12:00:00.9+00:00'),
    row('b', '2026-11-03T12:00:00.10+00:00'),
  ];
  assert.equal(nextCursor(rows, null), '2026-11-03T12:00:00.9+00:00');
});

// ─── حلّ التعارض ─────────────────────────────────────────────────────

test('صف جديد من السيرفر يُؤخذ', () => {
  assert.equal(resolve(undefined, row('a', '2026-11-03T12:00:00Z')), 'take_remote');
});

test('صف محلي نظيف: السيرفر هو المرجع', () => {
  const local = { ...row('a', '2026-11-03T10:00:00Z'), _dirty: 0 as const };
  assert.equal(resolve(local, row('a', '2026-11-03T12:00:00Z')), 'take_remote');
});

test('صف محلي نظيف وأحدث تاريخًا: السيرفر يفوز برضه', () => {
  // لأن النظيف معناه أنه مدفوع، فتاريخه المحلي لا يعني شيئًا
  const local = { ...row('a', '2030-01-01T00:00:00Z'), _dirty: 0 as const };
  assert.equal(resolve(local, row('a', '2026-11-03T12:00:00Z')), 'take_remote');
});

test('صف محلي dirty: يُحفظ ولا يُمسح — دفعه فشل', () => {
  const local = { ...row('a', '2026-11-03T09:00:00Z'), _dirty: 1 as const };
  assert.equal(resolve(local, row('a', '2026-11-03T12:00:00Z')), 'keep_local');
});

// ─── الترتيب ─────────────────────────────────────────────────────────

test('الآباء قبل الأبناء في ترتيب الدفع', () => {
  const at = (t: string) => TABLE_ORDER.indexOf(t as never);
  assert.ok(at('accounts') < at('transactions'), 'الحساب قبل العملية');
  assert.ok(at('categories') < at('transactions'), 'الفئة قبل العملية');
  assert.ok(at('accounts') < at('income_sources'));
  assert.ok(at('accounts') < at('fixed_commitments'));
  assert.ok(at('categories') < at('fixed_commitments'));
  assert.ok(at('accounts') < at('installments'));
  assert.ok(at('savings_goals') < at('savings_deposits'), 'الهدف قبل الحفظ');
  assert.ok(at('accounts') < at('savings_goals'));
});

test('كل جدول مرة واحدة، و profiles ليس فيها', () => {
  assert.equal(new Set(TABLE_ORDER).size, TABLE_ORDER.length);
  assert.ok(!TABLE_ORDER.includes('profiles' as never));
});

// ─── التقطيع ─────────────────────────────────────────────────────────

test('التقطيع يحفظ كل العناصر وترتيبها', () => {
  const items = Array.from({ length: 450 }, (_, i) => i);
  const parts = chunk(items, 200);
  assert.deepEqual(parts.map((p) => p.length), [200, 200, 50]);
  assert.deepEqual(parts.flat(), items);
});

test('قائمة فاضية = صفر دفعات، لا دفعة فاضية', () => {
  assert.deepEqual(chunk([], 200), []);
});

test('حجم أقل من ١ خطأ صريح لا حلقة لا نهائية', () => {
  assert.throws(() => chunk([1], 0), /size must be >= 1/);
});

// ─── تجهيز الصف للدفع ────────────────────────────────────────────────

test('الأعمدة المحلية و updated_at تُحذف قبل الدفع', () => {
  const local = {
    id: 'a',
    user_id: 'u',
    amount: 1500,
    _dirty: 1,
    _last_error: 'network',
    updated_at: '2026-11-03T09:00:00Z',
    created_at: '2026-11-03T09:00:00Z',
    deleted_at: null,
  };
  const pushed = forPush(local);
  assert.deepEqual(Object.keys(pushed).sort(), [
    'amount',
    'created_at',
    'deleted_at',
    'id',
    'user_id',
  ]);
});

test('الصفر والفراغ و null تُدفع ولا تُحذف', () => {
  const pushed = forPush({ id: 'a', amount: 0, description: '', deleted_at: null });
  assert.equal(pushed.amount, 0);
   assert.equal(pushed.description, '');
  assert.equal(pushed.deleted_at, null);
  assert.ok('deleted_at' in pushed, 'لو انحذف المفتاح ما ينتشر الحذف أبدًا');
});
