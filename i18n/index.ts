/**
 * ربط اللغتين.
 *
 * **لا دالة `t('home.remaining')` هنا، وهذا مقصود.** المسارات النصّية
 * تُلغي فائدة TypeScript: خطأ مطبعيّ في المسار يمرّ على المترجم ويظهر
 * في وجه المستخدم لصيقًا فارغًا. الوصول المباشر مفحوص مجانًا:
 *
 *   const s = strings(lang);
 *   <Text>{s.home.remaining}</Text>              // مفحوص ومُكمَّل تلقائيًّا
 *   <Text>{fill(s.add.willRemain, { amount })}</Text>
 */

import { ar, type Strings } from './ar';
import { en } from './en';
import { plural, toArabicDigits, type Countable } from './plurals';

export type Lang = 'ar' | 'en';

export { plural, toArabicDigits };
export type { Strings, Countable };

const CATALOGUES: Record<Lang, Strings> = { ar, en };

export function strings(lang: Lang): Strings {
  return CATALOGUES[lang];
}

export function isRTL(lang: Lang): boolean {
  return lang === 'ar';
}

/**
 * يضع القيم محلّ `{name}`.
 *
 * قيمة ناقصة تُترك كما هي ولا تُستبدل بفراغ: «يبقى لك {amount}» تكشف
 * الخلل في أوّل تشغيل، أمّا «يبقى لك » فتبدو نصًّا مكتوبًا هكذا وتعيش
 * في التطبيق شهورًا.
 */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

// ─── الأرقام ─────────────────────────────────────────────────────────

/**
 * علامتا LRM تحيطان الرقم.
 *
 * بدونهما ينكسر عرض المبالغ السالبة في النصّ العربيّ: المحرف `-`
 * محرف محايد في خوارزمية bidi، فيُلحق بالاتجاه المحيط ويظهر **يمين**
 * الرقم — «142.500-» بدل «-142.500». العلامتان تجعلان الرقم جزيرة
 * من اليسار لليمين داخل سطر من اليمين لليسار، فتستقرّ الإشارة مكانها.
 *
 * غير مرئيّتين، وبلا عرض، ولا تؤثّران على النسخ.
 */
const LRM = '‎';

function ltrIsland(s: string): string {
  return LRM + s + LRM;
}

export interface Currency {
  code: string;
  symbol: string;
  minorUnits: number;
}

/**
 * المال بأرقام لاتينية في اللغتين.
 *
 * هذا عُرف تطبيقات الخليج ولم أخالفه: المبلغ يُقرأ بلمحة، والأرقام
 * اللاتينية أسرع في القراءة الماليّة حتى لمن نصّه عربيّ بالكامل. أمّا
 * الأعداد في النصّ («٢٥ عملية») فعربيّة-هنديّة، وتلك `formatCount`.
 */
export function formatMoney(
  minor: number,
  currency: Currency,
  lang: Lang,
  opts: { withSymbol?: boolean; signed?: boolean } = {},
): string {
  const { withSymbol = true, signed = false } = opts;
  const factor = Math.pow(10, currency.minorUnits);
  const negative = minor < 0;
  const abs = (Math.abs(minor) / factor).toFixed(currency.minorUnits);

  let sign = '';
  if (negative) sign = '−'; // U+2212، لا شرطة ASCII: أوضح وأعرض
  else if (signed) sign = '+';

  const number = ltrIsland(sign + abs);
  if (!withSymbol) return number;

  // الرموز المحارفيّة ($ € £) تتقدّم في الإنجليزية، ورموز الحروف
  // (د.ك، ر.س، KWD) تتأخّر في اللغتين.
  const punctuationSymbol = /^[^\p{L}]+$/u.test(currency.symbol);
  if (lang === 'en' && punctuationSymbol) {
    return ltrIsland(currency.symbol + sign + abs);
  }
  return `${number} ${currency.symbol}`;
}

/** عدد في نصّ: عربيّ-هنديّ في العربية، لاتينيّ في الإنجليزية. */
export function formatCount(n: number, lang: Lang): string {
  const v = String(Math.trunc(n));
  return lang === 'ar' ? toArabicDigits(v) : v;
}

/** نسبة مئويّة. العربية تضع ٪ بعد الرقم، والإنجليزية % كذلك. */
export function formatPercent(ratio: number, lang: Lang): string {
  const pct = Math.round(ratio * 100);
  return lang === 'ar' ? `${toArabicDigits(pct)}٪` : `${pct}%`;
}

/** جمع العدد بصيغته الصحيحة: «حسابان» لا «٢ حسابات». */
export function count(lang: Lang, kind: Countable, n: number): string {
  return plural(lang, kind, n);
}

// ─── التواريخ ────────────────────────────────────────────────────────

/** "2026-11" → «نوفمبر ٢٠٢٥» أو "November 2026". */
export function formatMonthKey(monthKey: string, lang: Lang): string {
  const [y, m] = monthKey.split('-').map(Number);
  const name = strings(lang).months[m - 1];
  const year = lang === 'ar' ? toArabicDigits(y) : String(y);
  return `${name} ${year}`;
}

export function formatMonthShort(monthIndex: number, lang: Lang): string {
  return strings(lang).monthsShort[monthIndex];
}

/** يوم في الشهر: «١٣ نوفمبر» أو "13 November". */
export function formatDayMonth(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const day = d.getDate();
  const name = strings(lang).months[d.getMonth()];
  return lang === 'ar' ? `${toArabicDigits(day)} ${name}` : `${day} ${name}`;
}

// ─── الاتجاه في React Native ─────────────────────────────────────────

/**
 * `I18nManager.forceRTL` يحتاج إعادة تحميل التطبيق كاملًا، فلا يُنادى
 * من داخل شاشة. ضعه في `index.js` قبل أوّل render:
 *
 *   import { I18nManager } from 'react-native';
 *   import { applyDirection } from './i18n';
 *   applyDirection(savedLang ?? 'ar');
 *
 * وعند تبديل اللغة من الإعدادات: احفظ اللغة، نادِ هذه، ثم اطلب من
 * المستخدم إعادة فتح التطبيق (أو استخدم expo-updates reloadAsync).
 *
 * وبعدها استعمل `start`/`end` لا `left`/`right` في كلّ الأنماط، فتعمل
 * الشاشة في الاتجاهين بلا شرط.
 */
export function applyDirection(
  lang: Lang,
  I18nManager: { allowRTL(v: boolean): void; forceRTL(v: boolean): void },
): void {
  const rtl = isRTL(lang);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

/** `writingDirection` لكلّ نصّ. بدونه ينقلب السطر الذي يبدأ برقم. */
export function textDirection(lang: Lang): 'rtl' | 'ltr' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}
