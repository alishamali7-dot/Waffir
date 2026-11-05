/**
 * من حقول النموذج إلى صفّ في `transactions`.
 *
 * يعمل في المتصفّح للتنبيه الفوريّ، وعلى السيرفر للحكم: ما يصل إلى
 * Server Action لا يُوثَق به لأنّ الواجهة فحصته.
 */

import { parseAmountToMinor } from './supabase/functions/_shared/parse-amount';
import type { Fils } from './types';

/**
 * المبلغ بالوحدات الصغرى، أو null.
 *
 * `parseAmountToMinor` لا `parseIncomeInput`: هذه خانة مصروف، و«1,250»
 * بالدينار فيها دينارٌ وربع لا ألف. والملتبس («12.750» بالدولار) يُرفض
 * فيكتبه المستخدم بوضوح، بدل ألف ضعفٍ يمرّ بصمت.
 */
export function amountMinorOf(text: string, currencyCode: string): Fils | null {
  const value = parseAmountToMinor(text, currencyCode);
  return value !== null && value > 0 ? value : null;
}

/**
 * ظهر اليوم بتوقيت UTC.
 *
 * الميزانية تُصنِّف بنصّ التاريخ (`startsWith('2026-11')`)، وهو نصٌّ بتوقيت
 * UTC. فمصروف الساعة ١ صباحًا في الكويت يوم ١ نوفمبر، لو خُزّن بلحظته،
 * صار ٣١ أكتوبر ودخل الشهر الخطأ. والظهر يبقى في اليوم نفسه في كلّ منطقة
 * من UTC−12 إلى UTC+11.
 *
 * ponytail: دقّة يوم لا ساعة، وهو كلّ ما تعرضه الشاشات. الترتيب داخل اليوم
 * بـ`created_at`. يُصحَّح هذا حين يُعرض وقت العملية، أو يُصنَّف الشهر بتوقيت
 * المستخدم.
 */
export function occurredAtOf(date: string): string {
  return `${date}T12:00:00.000Z`;
}

const MAX_FUTURE_DAYS = 1;
const MAX_PAST_DAYS = 730;

function isUsableDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00.000Z`);
  // يرفض ما يقبله Date بصمت: ٣١ فبراير يصير ٣ مارس.
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) return false;
  const days = (time - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000;
  return days <= MAX_FUTURE_DAYS && days >= -MAX_PAST_DAYS;
}

export interface ExpenseInput {
  amount: string;
  categoryId: string;
  accountId: string;
  date: string;
  note: string;
  rawText?: string;
  /** بصمة النموذج: ضغطتان على «حفظ» عمليةٌ واحدة، ومصروفان متطابقان اثنتان. */
  key: string;
}

export function buildExpenseRow(input: ExpenseInput, currencyCode: string, today: string) {
  const amount = amountMinorOf(String(input.amount ?? ''), currencyCode);
  if (amount === null) return { error: 'amount' as const };
  if (!isUsableDate(String(input.date ?? ''), today)) return { error: 'date' as const };

  const categoryId = String(input.categoryId ?? '');
  const accountId = String(input.accountId ?? '');
  const key = String(input.key ?? '').slice(0, 64);
  if (!categoryId || !accountId || !key) return { error: 'save' as const };

  return {
    row: {
      occurred_at: occurredAtOf(input.date),
      amount,
      kind: 'expense' as const,
      description: String(input.note ?? '').trim().slice(0, 200),
      category_id: categoryId,
      account_id: accountId,
      source: 'manual' as const,
      raw_text: input.rawText ? String(input.rawText).slice(0, 500) : null,
      needs_review: false,
      dedupe_key: key,
    },
  };
}

export type LimitNote = { kind: 'ok' | 'low' | 'over'; amount: Fils };

/**
 * ماذا يفعل هذا المبلغ بحدّ الفئة. null إن لم يكن للفئة حدٌّ يُقاس عليه.
 * «low» حين يتخطّى عتبة التحذير نفسها التي تستعملها الميزانية.
 */
export function limitNoteOf(
  status: { limit: Fils; spent: Fils },
  amount: Fils,
  warnAt: number,
): LimitNote | null {
  if (status.limit <= 0) return null;
  const after = status.limit - status.spent - amount;
  if (after < 0) return { kind: 'over', amount: -after };
  const ratio = (status.spent + amount) / status.limit;
  return { kind: ratio >= warnAt ? 'low' : 'ok', amount: after };
}
