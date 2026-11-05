/**
 * الإدخال السريع — يحوّل "قهوة 1.5" إلى عملية جاهزة للتخزين.
 *
 * التصنيف بكلمات مفتاحية من Category.keywords — لا موديل ولا سيرفر.
 * ويتعلّم: كل مرة المستخدم يغيّر الفئة، أضِف الكلمة لـ keywords
 * (learnFromCorrection تحت) فيصير التطبيق أذكى بالاستعمال.
 */

import { Category, Fils, toFils } from './types';

export interface ParsedEntry {
  /** null = ما لقى مبلغ، الواجهة تطلبه من المستخدم */
  amount: Fils | null;
  /** النص بعد شيل المبلغ — اسم المصروف */
  label: string;
  categoryId: string | null;
  /** 'keyword' = مطابقة كلمة، 'fallback' = فئة المتنوع، 'none' = ما حدد */
  matchedBy: 'keyword' | 'fallback' | 'none';
  /** الكلمة اللي طابقت — نعرضها للمستخدم ليفهم ليش هذي الفئة */
  matchedKeyword?: string;
  /** النص كما كتبه المستخدم */
  rawText: string;
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'; // فارسية — بعض الكيبوردات تطلعها

/** ٢٥٫٥٠٠ → 25.500 */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const p = EXT_ARABIC_INDIC.indexOf(ch);
    if (a !== -1) out += String(a);
    else if (p !== -1) out += String(p);
    else if (ch === '٫' || ch === '،' || ch === ',') out += '.';
    else out += ch;
  }
  return out;
}

/**
 * `(?<!\p{L})` لا `\b`: الحدّ `\b` يعرف الحروف اللاتينية وحدها، فكان لا
 * يطابق كلمةً عربية أبدًا، وتتسرّب «دنانير» إلى اسم المصروف.
 */
const CURRENCY_NOISE =
  /(?<!\p{L})(?:د\.?\s?[كبإأ]|ر\.?\s?[سقع]|ج\.?\s?م|دينار|دنانير|فلس|فلوس|ريال|درهم|دراهم|جنيه|دولار|يورو|kwd|kd|sar|aed|usd|eur|dinar)(?!\p{L})/giu;

/**
 * المبلغ = آخر رقم في النص. "٢ قهوة" و"قهوة ٢" يشتغلان.
 * آخر واحد لأن "برجر ٢ ب ٣.٥" يعني ٣.٥ وليس ٢.
 */
function extractAmount(text: string): { amount: number | null; without: string } {
  const re = /\d+(?:\.\d{1,3})?/g;
  const found = [...text.matchAll(re)];
  if (found.length === 0) return { amount: null, without: text };
  const last = found[found.length - 1];
  const amount = parseFloat(last[0]);
  const without = text.slice(0, last.index) + ' ' + text.slice(last.index! + last[0].length);
  return { amount, without };
}

/** للمقارنة: تشيل التشكيل وتوحّد الألف والهمزة والتاء المربوطة. */
export function foldArabic(s: string): string {
  return s
    .normalize('NFKD')
    // حتى U+0655: بعد NFKD صارت «أ» ألفًا وهمزةً منفصلة، فتُحذف الهمزة معه.
    .replace(/[ً-ٰٕـ]/g, '') // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim();
}

export function parseQuickEntry(
  raw: string,
  categories: Category[],
  /** خانات عملة المستخدم. بدونها يصير 1.5 دولارًا ١٥ دولارًا. */
  minorUnits?: number,
): ParsedEntry {
  const normalized = normalizeDigits(raw).replace(CURRENCY_NOISE, ' ');
  const { amount, without } = extractAmount(normalized);
  const label = without.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();

  const haystack = foldArabic(label || normalized);
  const active = categories.filter((c) => !c.archived);

  for (const cat of active) {
    for (const kw of cat.keywords) {
      const folded = foldArabic(kw);
      if (folded.length > 1 && haystack.includes(folded)) {
        return {
          amount: amount === null ? null : toFils(amount, minorUnits),
          label: label || kw,
          categoryId: cat.id,
          matchedBy: 'keyword',
          matchedKeyword: kw,
          rawText: raw,
        };
      }
    }
  }

  // فئة "المتبقي" (monthlyLimit === null) هي سلة المتنوع
  const fallback = active.find((c) => c.monthlyLimit === null);
  return {
    amount: amount === null ? null : toFils(amount, minorUnits),
    label,
    categoryId: fallback ? fallback.id : null,
    matchedBy: fallback ? 'fallback' : 'none',
    rawText: raw,
  };
}

/** أبرز كلمة في النص، أو null. أطول كلمة = الأكثر تمييزًا عادة ("ستاربكس" لا "من"). */
export function keywordFrom(text: string): string | null {
  const words = foldArabic(normalizeDigits(text))
    .replace(/\d+(?:\.\d+)?/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * المستخدم صحّح الفئة → خزّن أبرز كلمة من النص في الفئة الصح.
 * يرجّع نسخة جديدة من المصفوفة (ما يعدّل الأصل).
 */
export function learnFromCorrection(
  categories: Category[],
  rawText: string,
  chosenCategoryId: string,
): Category[] {
  const keyword = keywordFrom(rawText);
  if (!keyword) return categories;

  return categories.map((c) => {
    if (c.id !== chosenCategoryId) return c;
    if (c.keywords.some((k) => foldArabic(k) === keyword)) return c;
    return { ...c, keywords: [...c.keywords, keyword] };
  });
}
