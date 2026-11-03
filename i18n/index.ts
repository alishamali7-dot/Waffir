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
 * عزل الرقم عن اتجاه السطر.
 *
 * بلا عزل ينكسر عرض المبالغ السالبة: محرف الإشارة محايد في خوارزمية
 * bidi فيُلحق بالاتجاه المحيط ويظهر **يمين** الرقم — «١٤٢٫٥٠٠−» بدل
 * «−١٤٢٫٥٠٠».
 *
 * والعلامة تختلف باختلاف الأرقام، وهذا ما يُغفل:
 *
 * - الأرقام اللاتينية (٠-٩ ASCII) صنفها **EN** في bidi، فتعزلها
 *   LRM (`U+200E`).
 * - الأرقام العربية-الهندية (٠١٢٣…) صنفها **AN**، ولها علامتها
 *   الخاصّة: ALM (`U+061C`) — «علامة الحرف العربيّ»، موضوعة لهذا
 *   الغرض بالضبط. واستعمال LRM معها يجبر اتجاهًا لاتينيًّا على رقم
 *   عربيّ فيزيد الخلل.
 *
 * العلامتان غير مرئيّتين وبلا عرض ولا تؤثّران على النسخ.
 */
const LRM = '‎';
const ALM = '؜';

function isolate(s: string, lang: Lang): string {
  const mark = lang === 'ar' ? ALM : LRM;
  return mark + s + mark;
}

export interface Currency {
  code: string;
  symbol: string;
  minorUnits: number;
}

/**
 * فاصلة العشرية العربية `٫` (U+066B).
 *
 * تُقترن بالأرقام العربية-الهندية كما تُقترن `.` باللاتينية. خلطُهما
 * («١٤٢.٥٠٠») يُقرأ لكنّه غير متّسق طباعيًّا.
 *
 * تبدّلها بـ`'.'` إن أردت النقطة مع الأرقام العربية — ثابت واحد.
 */
const AR_DECIMAL = '٫';

/**
 * المال بأرقام اللغة: عربية-هندية في العربية، لاتينية في الإنجليزية.
 *
 * (كان لاتينيًّا في الاثنين على عُرف تطبيقات الخليج؛ غُيّر بطلب
 * المالك في ٣ نوفمبر ٢٠٢٦.)
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
  let abs = (Math.abs(minor) / factor).toFixed(currency.minorUnits);

  if (lang === 'ar') {
    abs = toArabicDigits(abs).replace('.', AR_DECIMAL);
  }

  let sign = '';
  if (negative) sign = '−'; // U+2212، لا شرطة ASCII: أوضح وأعرض
  else if (signed) sign = '+';

  const number = isolate(sign + abs, lang);
  if (!withSymbol) return number;

  // الرموز المحارفيّة ($ € £) تتقدّم في الإنجليزية، ورموز الحروف
  // (د.ك، ر.س، KWD) تتأخّر في اللغتين.
  const punctuationSymbol = /^[^\p{L}]+$/u.test(currency.symbol);
  if (lang === 'en' && punctuationSymbol) {
    return isolate(currency.symbol + sign + abs, lang);
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
