/**
 * مساعدة الإدخال السريع بنموذجٍ — بعد القواعد لا قبلها.
 *
 * `parseQuickEntry` تعمل أوّلًا: فوريّة، مجّانيّة، بلا إنترنت، وتكفي
 * «قهوة ١٫٥» وهي أغلب ما يُكتب. فلا نُرسل كلّ سطرٍ إلى نموذج: نُرسل ما
 * عجزت عنه القواعد وحده.
 *
 * والدمج محافظ: الكلمة المفتاحيّة التي تعلّمها التطبيق من تصحيحِ المستخدم
 * نفسه أوثقُ من تخمين نموذج، فلا يُلغيها. النموذج يملأ الفراغ ولا يُزاحم.
 */

import type { Category, Fils } from './types';
import { foldArabic, normalizeDigits, parseQuickEntry, type ParsedEntry } from './quickEntry';

export type AssistConfidence = 'high' | 'medium' | 'low';

/** ما يعود من دالّة `parse-entry`. */
export interface EntrySuggestion {
  amount_text: string | null;
  amount_minor: Fils | null;
  currency: string;
  label: string | null;
  category_id: string | null;
  date: string | null;
  confidence: AssistConfidence;
  model: string;
}

export interface AssistedEntry extends ParsedEntry {
  /** YYYY-MM-DD أو null. القواعد لا تعرف التاريخ، فهذا من النموذج وحده. */
  date: string | null;
  /** هل ساهم النموذج فعلًا؟ تُستعمل لإظهار «مقترَح» في الواجهة. */
  assisted: boolean;
  /**
   * المبلغ جاء من نموذجٍ لا من رقمٍ كتبه المستخدم. الواجهة تُبرزه ولا
   * تُمرّره بصمت: رقمٌ لم يكتبه أحدٌ يستحقّ نظرةً قبل الحفظ.
   */
  amountIsSuggestion: boolean;
  suggestedCategoryId: string | null;
}

interface FunctionsClient {
  functions: {
    invoke(
      name: string,
      options: { body: Record<string, unknown> },
    ): Promise<{ data: unknown; error: unknown }>;
  };
}

/**
 * هل يستحقّ هذا السطر استدعاءً مدفوعًا؟
 *
 * نعم إن غاب المبلغ، أو لم تُطابق أيّ كلمةٍ مفتاحيّة (فالفئة حينها سلّةُ
 * المتنوّع أو لا شيء). ولو وُجد المبلغ وطابقت الكلمة فالقواعد كافية،
 * ويبقى التاريخ وحده غائبًا — ولا يُشترى تاريخٌ بمكالمة شبكة.
 */
export function needsAssist(parsed: ParsedEntry): boolean {
  return (
    parsed.amount === null ||
    parsed.matchedBy !== 'keyword' ||
    mentionsDate(parsed.rawText)
  );
}

/**
 * كلمة زمنيّة لا تفهمها القواعد. بدون هذا الفحص يُسجَّل «قهوة 1.5 امس»
 * باليوم صامتًا، لأنّ مبلغه وفئته واضحان فلا يُسأل النموذج.
 *
 * ponytail: قائمة كلمات، فصيغةٌ غير مذكورة تفوتها؛ تُوسَّع حين يظهر نقص.
 * وأسوأ الخطأ هنا مكالمةٌ زائدة أو تاريخٌ يصحّحه المستخدم.
 */
const DATE_WORDS =
  /(?<!\p{L})(?:امس|الامس|البارح|البارحه|امبارح|قبل|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|السبت|yesterday|ago|last|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?!\p{L})/iu;

export function mentionsDate(raw: string): boolean {
  return DATE_WORDS.test(foldArabic(normalizeDigits(raw)));
}

/** تاريخ اليوم عند المستخدم، لا عند السيرفر. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * يدمج اقتراح النموذج في ناتج القواعد. دالّةٌ خالصة — تُختبر بلا شبكة.
 */
export function mergeAssist(
  parsed: ParsedEntry,
  suggestion: EntrySuggestion | null,
): AssistedEntry {
  if (!suggestion) {
    return {
      ...parsed,
      date: null,
      assisted: false,
      amountIsSuggestion: false,
      suggestedCategoryId: null,
    };
  }

  // رقمٌ كتبه المستخدم لا يُنقَض. النموذج يملأ الغائب فقط.
  const amountFromModel = parsed.amount === null && suggestion.amount_minor !== null;
  const amount = parsed.amount ?? suggestion.amount_minor;

  // الكلمة المفتاحيّة نتيجةُ تصحيحٍ سابقٍ من المستخدم: لها الأولويّة.
  const keepRuleCategory = parsed.matchedBy === 'keyword';
  const categoryId = keepRuleCategory
    ? parsed.categoryId
    : suggestion.category_id ?? parsed.categoryId;

  // اسم النموذج أنظف: اسم القواعد يبقى فيه «امس» و«بثلاثة ونص».
  const label = suggestion.label?.trim() || parsed.label;

  const categoryFromModel = !keepRuleCategory
    && suggestion.category_id !== null
    && suggestion.category_id !== parsed.categoryId;

  return {
    ...parsed,
    amount,
    label,
    categoryId,
    matchedBy: keepRuleCategory ? 'keyword' : categoryFromModel ? 'fallback' : parsed.matchedBy,
    date: suggestion.date,
    assisted: amountFromModel || categoryFromModel || suggestion.date !== null,
    amountIsSuggestion: amountFromModel,
    suggestedCategoryId: categoryFromModel ? suggestion.category_id : null,
  };
}

export type AssistOutcome =
  | { ok: true; entry: AssistedEntry }
  | { ok: false; entry: AssistedEntry; error: string };

/**
 * المسار الكامل: قواعد، ثمّ نموذجٌ عند الحاجة، ثمّ دمج.
 *
 * الفشل لا يُفقد المستخدم شيئًا: يعود ناتج القواعد كما هو مع سبب الفشل،
 * فيُكمل الإدخال بيده. الإدخال اليدويّ يعمل دائمًا — وهذا أصل التطبيق.
 */
export async function assistedQuickEntry(
  client: FunctionsClient,
  raw: string,
  categories: Category[],
  opts: { today?: string; force?: boolean; minorUnits?: number } = {},
): Promise<AssistOutcome> {
  const parsed = parseQuickEntry(raw, categories, opts.minorUnits);
  if (!opts.force && !needsAssist(parsed)) {
    return { ok: true, entry: mergeAssist(parsed, null) };
  }

  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await client.functions.invoke('parse-entry', {
      body: { text: raw, today: opts.today ?? localToday() },
    }));
  } catch (e) {
    return { ok: false, entry: mergeAssist(parsed, null), error: String(e) };
  }

  const payload = (data ?? null) as Record<string, unknown> | null;
  if (payload && typeof payload.error === 'string') {
    return { ok: false, entry: mergeAssist(parsed, null), error: payload.error };
  }
  if (error) {
    return {
      ok: false,
      entry: mergeAssist(parsed, null),
      error: String((error as Error)?.message ?? error),
    };
  }

  const suggestion = payload?.suggestion as EntrySuggestion | undefined;
  if (!suggestion || typeof suggestion !== 'object') {
    return { ok: false, entry: mergeAssist(parsed, null), error: 'no_suggestion' };
  }

  return { ok: true, entry: mergeAssist(parsed, suggestion) };
}
