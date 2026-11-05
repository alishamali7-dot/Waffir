// استدعاء دالّة `read-receipt` من الجوّال والويب بالسطر نفسه.
//
// الدالّة تُقترح ولا تُقيَّد: ما يعود من هنا يُعرض على المستخدم ليؤكّده أو
// يُعدّله. من يستدعي هذا الملفّ ثمّ يكتب العملية بلا تأكيدٍ قد خالف القصد.

import type { ReceiptExtraction } from '../types';

/** أخطاءٌ نُسمّيها لأنّ لكلٍّ منها رسالةٌ مختلفة في الواجهة. */
export type ReadReceiptError =
  | 'not_found'
  | 'unsupported_type'
  | 'too_large'
  | 'download_failed'
  | 'openrouter_failed'
  | 'openrouter_unreachable'
  | 'empty_completion'
  | 'unparseable_completion'
  | 'missing_openrouter_key'
  | 'invalid_token'
  | 'unknown';

export type ReadReceiptResult =
  | { ok: true; extraction: ReceiptExtraction; cached: boolean; stored: boolean }
  | { ok: false; error: ReadReceiptError; detail?: string };

/** أقلّ ما نحتاجه من عميل Supabase، حتّى لا يُقيَّد هذا الملفّ بنسخةٍ منه. */
interface FunctionsClient {
  functions: {
    invoke(
      name: string,
      options: { body: Record<string, unknown> },
    ): Promise<{ data: unknown; error: unknown }>;
  };
}

const KNOWN_ERRORS = new Set<string>([
  'not_found', 'unsupported_type', 'too_large', 'download_failed',
  'openrouter_failed', 'openrouter_unreachable', 'empty_completion',
  'unparseable_completion', 'missing_openrouter_key', 'invalid_token',
]);

/**
 * يقرأ فاتورةً مرفوعة. `force` يُعيد القراءة ويدفع ثمنها مرّةً أخرى، فلا
 * يُستعمل إلّا بطلب المستخدم (زرّ «أعد القراءة») لا تلقائيًّا.
 *
 * المرفَق الذي لم يُرفع ملفّه بعد (`_pendingUpload`) لا يُقرأ: السيرفر لا
 * يجد بايتاته. انتظر رفعه أوّلًا.
 */
export async function readReceipt(
  client: FunctionsClient,
  attachmentId: string,
  opts: { force?: boolean } = {},
): Promise<ReadReceiptResult> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await client.functions.invoke('read-receipt', {
      body: { attachmentId, force: opts.force === true },
    }));
  } catch (e) {
    return { ok: false, error: 'unknown', detail: String(e) };
  }

  // جسم الخطأ يحمل سببًا مفيدًا، فنقرأه قبل أن نستسلم لـerror.
  const payload = (data ?? null) as Record<string, unknown> | null;

  if (payload && typeof payload.error === 'string') {
    const name = KNOWN_ERRORS.has(payload.error)
      ? (payload.error as ReadReceiptError)
      : 'unknown';
    const detail = typeof payload.detail === 'string' ? payload.detail : undefined;
    return { ok: false, error: name, detail };
  }

  if (error) {
    return { ok: false, error: 'unknown', detail: String((error as Error)?.message ?? error) };
  }

  const extraction = payload?.extraction as ReceiptExtraction | undefined;
  if (!extraction || typeof extraction !== 'object') {
    return { ok: false, error: 'unknown', detail: 'لا اقتراح في الجواب' };
  }

  return {
    ok: true,
    extraction,
    cached: payload?.cached === true,
    // المخزَّن غير الموجود: قراءةٌ نجحت ولم تُحفظ تُعاد لو طُلبت ثانيةً.
    stored: payload?.stored !== false,
  };
}

/**
 * هل يصلح هذا الاقتراح لملء حقل المبلغ من نفسه؟
 *
 * شرطان: رقمٌ غير ملتبس، وثقةٌ ليست منخفضة. ما دون ذلك يُعرض نصًّا
 * ليقرأه المستخدم ويكتبه بيده — أهونُ من رقمٍ خاطئ يمرّ لأنّه ظهر جاهزًا.
 */
export function isPrefillable(extraction: ReceiptExtraction): boolean {
  return extraction.total_minor !== null && extraction.confidence !== 'low';
}
