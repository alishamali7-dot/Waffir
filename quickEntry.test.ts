/**
 * node --test (بدون أي مكتبة اختبار).
 *   npx tsx --test quickEntry.test.ts
 * أو بعد الترجمة:  node --test quickEntry.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickEntry, learnFromCorrection, foldArabic } from './quickEntry';
import { Category } from './types';
import { ICONS } from './templates';

const cats: Category[] = [
  {
    id: 'food',
    name: 'أكل وشراب',
    color: '#E8590C',
    icon: ICONS.food,
    monthlyLimit: 180_000,
    keywords: ['مقاضي', 'لحم', 'سوق'],
    order: 1,
    archived: false,
  },
  {
    id: 'dining',
    name: 'مطاعم وقهوة',
    color: '#C2255C',
    icon: ICONS.cafe,
    monthlyLimit: 80_000,
    keywords: ['قهوة', 'مطعم', 'كافي'],
    order: 2,
    archived: false,
  },
  {
    id: 'misc',
    name: 'أخرى',
    color: '#495057',
    icon: ICONS.other,
    monthlyLimit: null,
    keywords: [],
    order: 9,
    archived: false,
  },
];

test('المثال الأساس: قهوة 1.5', () => {
  const r = parseQuickEntry('قهوة 1.5', cats);
  assert.equal(r.amount, 1500);
  assert.equal(r.categoryId, 'dining');
  assert.equal(r.label, 'قهوة');
  assert.equal(r.matchedBy, 'keyword');
});

test('الأرقام العربية والفاصلة العربية', () => {
  const r = parseQuickEntry('مقاضي ٢٥٫٥٠٠', cats);
  assert.equal(r.amount, 25500);
  assert.equal(r.categoryId, 'food');
});

test('المبلغ قبل الاسم', () => {
  const r = parseQuickEntry('٣ قهوة', cats);
  assert.equal(r.amount, 3000);
  assert.equal(r.categoryId, 'dining');
});

test('آخر رقم هو المبلغ', () => {
  const r = parseQuickEntry('برجر 2 ب 3.5', cats);
  assert.equal(r.amount, 3500);
});

test('يشيل ذكر العملة', () => {
  const r = parseQuickEntry('مطعم 12 د.ك', cats);
  assert.equal(r.amount, 12000);
  assert.equal(r.categoryId, 'dining');
});

test('بدون مبلغ → amount = null والواجهة تسأل', () => {
  const r = parseQuickEntry('قهوة', cats);
  assert.equal(r.amount, null);
  assert.equal(r.categoryId, 'dining');
});

test('كلمة غير معروفة → فئة المتبقي', () => {
  const r = parseQuickEntry('حلاق 5', cats);
  assert.equal(r.categoryId, 'misc');
  assert.equal(r.matchedBy, 'fallback');
});

test('التطويل والهمزة ما يخربان المطابقة', () => {
  assert.equal(foldArabic('مـقـاضـي'), foldArabic('مقاضي'));
  const r = parseQuickEntry('مـقـاضـي ١٠', cats);
  assert.equal(r.categoryId, 'food');
});

test('ثلاث خانات عشرية تبقى دقيقة بالفلس', () => {
  const r = parseQuickEntry('سوق 25.750', cats);
  assert.equal(r.amount, 25750);
});

test('التعلّم من التصحيح يضيف الكلمة ولا يكرّرها', () => {
  const once = learnFromCorrection(cats, 'ستاربكس 2.5', 'dining');
  const dining = once.find((c) => c.id === 'dining')!;
  assert.ok(dining.keywords.includes('ستاربكس'));

  const twice = learnFromCorrection(once, 'ستاربكس 3', 'dining');
  const again = twice.find((c) => c.id === 'dining')!;
  assert.equal(again.keywords.filter((k) => k === 'ستاربكس').length, 1);

  // الأصل ما تغيّر
  assert.equal(cats.find((c) => c.id === 'dining')!.keywords.length, 3);
});

test('بعد التعلّم يصنّف صح', () => {
  const learned = learnFromCorrection(cats, 'ستاربكس 2.5', 'dining');
  assert.equal(parseQuickEntry('ستاربكس 4', learned).categoryId, 'dining');
});
