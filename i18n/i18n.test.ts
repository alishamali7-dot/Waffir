/**
 * npx tsx --test i18n/i18n.test.ts
 *
 * أثقل الاختبارات على العدد والمعدود، لأنه الموضع الذي يخطئ فيه كلّ
 * تطبيق عربيّ تقريبًا: جمع واحد مع رقم أمامه.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ar } from './ar';
import { en } from './en';
import {
  AR_PLURALS,
  arabicCategory,
  englishCategory,
  plural,
  toArabicDigits,
  type Countable,
} from './plurals';
import {
  count,
  fill,
  formatCount,
  formatMonthKey,
  formatMoney,
  formatPercent,
  isRTL,
  strings,
  textDirection,
  type Currency,
} from './index';

const KWD: Currency = { code: 'KWD', symbol: 'د.ك', minorUnits: 3 };
const USD: Currency = { code: 'USD', symbol: '$', minorUnits: 2 };
const JPY: Currency = { code: 'JPY', symbol: '¥', minorUnits: 0 };

// نزيل علامتَي LRM قبل المقارنة: غير مرئيّتين ووجودهما مُختبَر وحده
const bare = (s: string) => s.replace(/‎/g, '');

// ─── تطابق القائمتين ────────────────────────────────────────────────

test('الإنجليزية تطابق العربية مفتاحًا بمفتاح', () => {
  const walk = (a: unknown, b: unknown, path: string): string[] => {
    const bad: string[] = [];
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return [`${path}: ليست مصفوفة`];
      if (a.length !== b.length) bad.push(`${path}: الطول ${b.length} بدل ${a.length}`);
      return bad;
    }
    if (typeof a === 'object' && a !== null) {
      if (typeof b !== 'object' || b === null) return [`${path}: ليست كائنًا`];
      const ka = Object.keys(a).sort();
      const kb = Object.keys(b as object).sort();
      for (const k of ka) if (!kb.includes(k)) bad.push(`${path}.${k}: ناقص`);
      for (const k of kb) if (!ka.includes(k)) bad.push(`${path}.${k}: زائد`);
      for (const k of ka.filter((k) => kb.includes(k))) {
        bad.push(
          ...walk(
            (a as Record<string, unknown>)[k],
            (b as Record<string, unknown>)[k],
            `${path}.${k}`,
          ),
        );
      }
      return bad;
    }
    if (typeof a !== typeof b) bad.push(`${path}: نوع مختلف`);
    return bad;
  };

  assert.deepEqual(walk(ar, en, ''), []);
});

test('لا نصّ فارغ في أي لغة', () => {
  const empties: string[] = [];
  const walk = (o: unknown, path: string) => {
    if (typeof o === 'string') {
      if (o.trim() === '') empties.push(path);
      return;
    }
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (typeof o === 'object' && o !== null) {
      for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    }
  };
  walk(ar, 'ar');
  walk(en, 'en');
  assert.deepEqual(empties, []);
});

test('كل {placeholder} في العربية موجود في الإنجليزية', () => {
  const holes = (s: string) =>
    [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const mismatch: string[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (typeof a === 'string' && typeof b === 'string') {
      const ha = holes(a);
      const hb = holes(b);
      if (ha.join(',') !== hb.join(',')) {
        mismatch.push(`${path}: ar[${ha}] vs en[${hb}]`);
      }
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) return;
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
      for (const k of Object.keys(a)) {
        walk(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
          `${path}.${k}`,
        );
      }
    }
  };
  walk(ar, en, '');
  assert.deepEqual(mismatch, []);
});

// ─── العدد والمعدود ─────────────────────────────────────────────────

test('تصنيف العربية يطابق قواعد CLDR', () => {
  assert.equal(arabicCategory(0), 'zero');
  assert.equal(arabicCategory(1), 'one');
  assert.equal(arabicCategory(2), 'two');
  assert.equal(arabicCategory(3), 'few');
  assert.equal(arabicCategory(10), 'few');
  assert.equal(arabicCategory(11), 'many');
  assert.equal(arabicCategory(99), 'many');
  assert.equal(arabicCategory(100), 'other');
  assert.equal(arabicCategory(101), 'other');
  // few و many على باقي القسمة على ١٠٠
  assert.equal(arabicCategory(103), 'few', '١٠٣ ← ٣ ← few');
  assert.equal(arabicCategory(110), 'few', '١١٠ ← ١٠ ← few');
  assert.equal(arabicCategory(115), 'many', '١١٥ ← ١٥ ← many');
  assert.equal(arabicCategory(200), 'other');
});

test('المثنّى: «حسابان» لا «٢ حسابات»', () => {
  assert.equal(plural('ar', 'account', 2), 'حسابان');
  assert.ok(!plural('ar', 'account', 2).includes('٢'), 'المثنّى بلا رقم');
});

test('المفرد بلا رقم: «عملية واحدة» لا «١ عمليات»', () => {
  assert.equal(plural('ar', 'entry', 1), 'عملية واحدة');
});

test('الصفر نفي صريح لا رقمًا', () => {
  assert.equal(plural('ar', 'entry', 0), 'لا توجد عمليات');
  assert.equal(plural('en', 'entry', 0), 'No entries');
});

test('٣–١٠ جمع، و١١–٩٩ مفرد منصوب', () => {
  assert.equal(plural('ar', 'entry', 7), '٧ عمليات');
  assert.equal(plural('ar', 'entry', 25), '٢٥ عملية');
  assert.equal(plural('ar', 'day', 5), '٥ أيام');
  assert.equal(plural('ar', 'day', 17), '١٧ يومًا');
});

test('ما بعد المئة: مفرد مجرور', () => {
  assert.equal(plural('ar', 'entry', 100), '١٠٠ عملية');
  assert.equal(plural('ar', 'day', 200), '٢٠٠ يوم');
});

test('السلسلة المتواصلة تتبع القاعدة نفسها', () => {
  assert.equal(plural('ar', 'streakDay', 1), 'يوم واحد متواصل');
  assert.equal(plural('ar', 'streakDay', 2), 'يومان متواصلان');
  assert.equal(plural('ar', 'streakDay', 12), '١٢ يومًا متواصلًا');
  assert.equal(plural('ar', 'streakDay', 5), '٥ أيام متواصلة');
});

test('الإنجليزية صيغتان فقط', () => {
  assert.equal(englishCategory(1), 'one');
  assert.equal(englishCategory(2), 'other');
  assert.equal(plural('en', 'account', 1), '1 account');
  assert.equal(plural('en', 'account', 2), '2 accounts');
  assert.equal(plural('en', 'category', 5), '5 categories');
});

test('count() يختار لغة الواجهة', () => {
  assert.equal(count('ar', 'goal', 2), 'هدفان');
  assert.equal(count('en', 'goal', 2), '2 goals');
});

test('كل معدود عربي عنده الحالات الستّ، ولا {n} متسرّب', () => {
  const kinds = Object.keys(AR_PLURALS) as Countable[];
  const missing: string[] = [];
  for (const k of kinds) {
    for (const n of [0, 1, 2, 3, 11, 100]) {
      const out = plural('ar', k, n);
      if (!out || out.includes('{n}')) missing.push(`${k}@${n}`);
    }
  }
  assert.deepEqual(missing, []);
});

// ─── الأرقام ────────────────────────────────────────────────────────

test('الأرقام العربية-الهندية', () => {
  assert.equal(toArabicDigits(2026), '٢٠٢٦');
  assert.equal(toArabicDigits('12/5'), '١٢/٥');
  // ما ليس رقمًا يبقى كما هو
  assert.equal(toArabicDigits('142.500 د.ك'), '١٤٢.٥٠٠ د.ك');
});

test('الصفر في الإنجليزية لا يخرج «0 entries»', () => {
  // CLDR تضع الصفر في other، فالصيغة المعلنة zero تتقدّم عليها
  assert.equal(englishCategory(0), 'other', 'التصنيف نفسه يبقى CLDR');
  assert.equal(plural('en', 'entry', 0), 'No entries');
  assert.equal(plural('ar', 'entry', 0), 'لا توجد عمليات');
});

test('المال بأرقام لاتينية في اللغتين', () => {
  assert.equal(bare(formatMoney(142500, KWD, 'ar')), '142.500 د.ك');
  assert.equal(bare(formatMoney(142500, KWD, 'en')), '142.500 د.ك');
});

test('خانات العملة لا خانات اللغة', () => {
  assert.equal(bare(formatMoney(142500, KWD, 'ar', { withSymbol: false })), '142.500');
  assert.equal(bare(formatMoney(14250, USD, 'en', { withSymbol: false })), '142.50');
  assert.equal(bare(formatMoney(1425, JPY, 'en', { withSymbol: false })), '1425');
});

test('الرموز المحارفية تتقدّم في الإنجليزية فقط', () => {
  assert.equal(bare(formatMoney(14250, USD, 'en')), '$142.50');
  assert.equal(bare(formatMoney(14250, USD, 'ar')), '142.50 $');
});

test('السالب: إشارة ناقص حقيقية، لا شرطة ASCII', () => {
  const out = bare(formatMoney(-6000, KWD, 'ar', { withSymbol: false }));
  assert.equal(out, '−6.000');
  assert.ok(out.includes('−'), 'U+2212 لا hyphen');
  assert.ok(!out.includes('-'), 'بلا شرطة ASCII');
});

test('علامتا LRM تحيطان الرقم — تمنع انقلاب الإشارة في RTL', () => {
  const out = formatMoney(-6000, KWD, 'ar');
  assert.ok(out.startsWith('‎'), 'تبدأ بـ LRM');
  assert.ok(
    out.indexOf('‎', 1) > 0,
    'وتُغلق بـ LRM بعد الرقم قبل الرمز',
  );
  // الرمز العربي خارج الجزيرة
  assert.ok(out.endsWith('د.ك'));
});

test('signed يُظهر + للموجب ولا يكرّر − للسالب', () => {
  assert.equal(bare(formatMoney(6000, KWD, 'ar', { signed: true })), '+6.000 د.ك');
  assert.equal(bare(formatMoney(-6000, KWD, 'ar', { signed: true })), '−6.000 د.ك');
  assert.equal(bare(formatMoney(6000, KWD, 'ar')), '6.000 د.ك');
});

test('الصفر بلا إشارة', () => {
  assert.equal(bare(formatMoney(0, KWD, 'ar')), '0.000 د.ك');
});

test('العدد في النصّ عربي-هندي، والنسبة بعلامتها', () => {
  assert.equal(formatCount(25, 'ar'), '٢٥');
  assert.equal(formatCount(25, 'en'), '25');
  assert.equal(formatPercent(0.89, 'ar'), '٨٩٪');
  assert.equal(formatPercent(0.89, 'en'), '89%');
});

// ─── الاستبدال ──────────────────────────────────────────────────────

test('fill يضع القيم', () => {
  assert.equal(
    fill(ar.add.willRemain, { amount: '8.750 د.ك' }),
    'يبقى لك 8.750 د.ك في هذه الفئة',
  );
});

test('قيمة ناقصة تُترك ظاهرة لا تُمسح', () => {
  // «يبقى لك » تبدو نصًّا مقصودًا وتعيش شهورًا؛ «{amount}» تُكشف فورًا
  assert.equal(fill('يبقى لك {amount} هنا', {}), 'يبقى لك {amount} هنا');
});

test('الصفر قيمة صحيحة ولا يُعتبر ناقصًا', () => {
  assert.equal(fill('{n} عملية', { n: 0 }), '0 عملية');
});

// ─── الاتجاه والأشهر ────────────────────────────────────────────────

test('الاتجاه', () => {
  assert.equal(isRTL('ar'), true);
  assert.equal(isRTL('en'), false);
  assert.equal(textDirection('ar'), 'rtl');
  assert.equal(textDirection('en'), 'ltr');
});

test('الشهر بالاسم وسنته بأرقام لغته', () => {
  assert.equal(formatMonthKey('2026-11', 'ar'), 'نوفمبر ٢٠٢٦');
  assert.equal(formatMonthKey('2026-11', 'en'), 'November 2026');
  assert.equal(formatMonthKey('2027-01', 'ar'), 'يناير ٢٠٢٧');
});

test('أسماء الأشهر والأيام مكتملة في اللغتين', () => {
  for (const lang of ['ar', 'en'] as const) {
    const s = strings(lang);
    assert.equal(s.months.length, 12, `${lang}: الأشهر`);
    assert.equal(s.monthsShort.length, 12, `${lang}: المختصرة`);
    assert.equal(s.weekdays.length, 7, `${lang}: الأيام`);
  }
});
