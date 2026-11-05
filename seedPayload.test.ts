import { test } from 'node:test';
import assert from 'node:assert/strict';

import { strings } from './i18n';
import { buildSeed, isEmptyAccount, parseIncomeInput, splitOf } from './seedPayload';
import { SITUATIONS, seedState } from './templates';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const seedOf = (shape: Parameters<typeof seedState>[0], income: number, lang: 'ar' | 'en' = 'ar') =>
  buildSeed(seedState(shape, income), strings(lang).seed, lang);

test('الدخل: الأرقام العربية والفاصلة والفراغ', () => {
  assert.equal(parseIncomeInput('1250.500'), 1250.5);
  assert.equal(parseIncomeInput('١٢٥٠٫٥٠٠'), 1250.5);
  // فاصلة آلاف في خانة راتب، لا كسر كما في الفواتير
  assert.equal(parseIncomeInput('1,250'), 1250);
  assert.equal(parseIncomeInput('١٬٢٥٠'), 1250);
  assert.equal(parseIncomeInput('  '), 0);
  assert.equal(parseIncomeInput(''), 0);
});

test('الدخل: ما لا يُفهم يُرفض ولا يصير صفرًا', () => {
  assert.equal(parseIncomeInput('ألف'), null);
  assert.equal(parseIncomeInput('12.5.3'), null);
  assert.equal(parseIncomeInput('-500'), null);
  assert.equal(parseIncomeInput('99999999999'), null);
});

test('الحساب الفارغ يحتاج خلوّ الحسابات والفئات معًا', () => {
  assert.equal(isEmptyAccount({ accounts: [], categories: [] }), true);
  const seeded = seedState('none', 0);
  assert.equal(isEmptyAccount(seeded), false);
  assert.equal(isEmptyAccount({ accounts: [], categories: seeded.categories }), false);
});

test('كلّ وضع: كلّ معرّف uuid، وكلّ إشارة تقع على حسابٍ مبذور', () => {
  for (const { shape } of SITUATIONS) {
    const seed = seedOf(shape, 1250);
    const accounts = new Set(seed.accounts.map((a) => a.id));
    const rows = [...seed.accounts, ...seed.categories, ...seed.income_sources, ...seed.commitments, ...seed.goals];
    for (const row of rows) assert.match(row.id, UUID, shape);
    assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, `${shape}: معرّفات مكرّرة`);
    for (const row of [...seed.income_sources, ...seed.goals]) {
      assert.ok(row.account_id && accounts.has(row.account_id), `${shape}: ${row.name}`);
    }
  }
});

test('كلّ وضع: فئة واحدة تأخذ المتبقّي — القاعدة تفرضها بفهرس فريد', () => {
  for (const { shape } of SITUATIONS) {
    const remainder = seedOf(shape, 1250).categories.filter((c) => c.monthly_limit === null);
    assert.equal(remainder.length, 1, shape);
  }
});

test('تخطّي الدخل لا يُنتج صفًّا تأباه القاعدة', () => {
  for (const { shape } of SITUATIONS) {
    const seed = seedOf(shape, 0);
    assert.deepEqual(seed.income_sources, [], shape);
    // savings_goals_amount_ck: amount_per_period > 0
    assert.deepEqual(seed.goals, [], shape);
    assert.equal(seed.profile.pay_day_of_month, null, shape);
    for (const c of seed.categories) assert.ok(c.monthly_limit === null || c.monthly_limit >= 0);
  }
});

test('الأسماء بلغة المستخدم، والحدّ الأقصى للاسم محترم', () => {
  const ar = seedOf('fixed_salary', 1250, 'ar');
  const en = seedOf('fixed_salary', 1250, 'en');
  assert.equal(ar.categories[0].name, 'أكل وشراب');
  assert.equal(en.categories[0].name, 'Food and groceries');
  assert.equal(en.profile.locale, 'en');
  assert.equal(en.income_sources[0].name, 'Main income');
  assert.equal(seedOf('allowance', 100, 'en').income_sources[0].name, 'Allowance');
  // لا اسم عربيّ يتسرّب إلى حساب إنجليزيّ
  const all = [...en.accounts, ...en.categories, ...en.commitments, ...en.goals, ...en.income_sources];
  for (const row of all) assert.doesNotMatch(row.name, /[؀-ۿ]/, row.name);
  for (const row of [...ar.accounts, ...ar.categories]) {
    assert.ok(row.name.trim().length >= 1 && row.name.length <= 60);
  }
});

test('أسماء البذور العربية تطابق القالب حرفًا بحرف', () => {
  const s = seedState('fixed_salary', 1250);
  const names = strings('ar').seed as Record<string, string>;
  for (const row of [...s.accounts, ...s.categories, ...s.commitments, ...s.goals]) {
    assert.equal(names[row.id], row.name, row.id);
  }
});

test('الملفّ الشخصيّ يحمل العملة ويوم الراتب', () => {
  const state = seedState('fixed_salary', 500, 'USD', 25);
  const { profile } = buildSeed(state, strings('en').seed, 'en');
  assert.equal(profile.currency_code, 'USD');
  assert.equal(profile.minor_units, 2);
  assert.equal(profile.pay_day_of_month, 25);
  assert.equal(profile.income_shape, 'fixed_salary');
  assert.equal(profile.alert_salary_day_rollover, true);
  // الدخل المتغيّر بلا يوم ثابت
  assert.equal(buildSeed(seedState('variable', 500), strings('en').seed, 'en').profile.pay_day_of_month, null);
});

test('التقسيم يساوي الدخل، ولا يُكتب فيه ما لن يُبذر', () => {
  const s = splitOf(seedState('fixed_salary', 1000));
  assert.equal(s.total, 1_000_000);
  assert.equal(s.fixed + s.limits + s.savings + s.free, s.total);
  assert.ok(s.limits > 0 && s.savings > 0 && s.free > 0);
  assert.equal(splitOf(seedState('allowance', 50)).savings, 0);
});
