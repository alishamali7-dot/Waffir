/**
 * منطق طابور رفع الفواتير — دوال نقيّة، بلا شبكة ولا ملفّات.
 *
 * ## القرار الحاكم: الملفّ يُرفع قبل أن يُزامَن صفّه
 *
 * المرفق صفٌّ في القاعدة وملفٌّ في التخزين، وترتيبهما ليس تفصيلًا.
 *
 * لو سبق الصفُّ الملفَّ، فجهازك الثاني يسحب الصفّ ويحاول عرض فاتورة
 * لا وجود لها بعد — صورة مكسورة، ولا يعرف المستخدم أعطبٌ هو أم
 * انتظار.
 *
 * فالصفّ يُولد **نظيفًا** (`_dirty = 0`) ومعه `_pendingUpload = 1`،
 * فلا تلمسه المزامنة أصلًا. ومتى نجح الرفع قُلب إلى
 * (`_dirty = 1`, `_pendingUpload = 0`) فتحمله المزامنة التالية.
 *
 * وجمال هذا أنّه **لا يغيّر طبقة المزامنة بحرف**: هي تدفع ما هو
 * `_dirty` كعادتها، والترتيب يأتي من متى يصير الصفّ كذلك.
 */

import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type AttachmentKind,
  type AttachmentMime,
} from '../types';

// ─── التحقّق ─────────────────────────────────────────────────────────

export interface PickedFile {
  uri: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
}

export type Invalid =
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'too_large'; byteSize: number; max: number }
  | { ok: false; reason: 'bad_mime'; mimeType: string };

export type Valid = { ok: true; kind: AttachmentKind; mimeType: AttachmentMime };

/**
 * حدّ ثقة: الملفّ يختاره المستخدم، فقد يكون أيّ شيء.
 *
 * الفحص هنا **لا يُغني** عن حدود الـbucket على السيرفر — ذاك هو
 * الحارس، وهذا رسالةٌ مفهومة قبل إهدار رفعٍ سيُرفض.
 */
export function validate(file: PickedFile): Valid | Invalid {
  if (file.byteSize <= 0) return { ok: false, reason: 'empty' };
  if (file.byteSize > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: 'too_large', byteSize: file.byteSize, max: MAX_ATTACHMENT_BYTES };
  }
  const mime = file.mimeType.toLowerCase().split(';')[0].trim();
  if (!(ALLOWED_ATTACHMENT_MIME as readonly string[]).includes(mime)) {
    return { ok: false, reason: 'bad_mime', mimeType: file.mimeType };
  }
  return {
    ok: true,
    mimeType: mime as AttachmentMime,
    kind: mime === 'application/pdf' ? 'pdf' : 'image',
  };
}

// ─── المسار ──────────────────────────────────────────────────────────

const EXT: Record<AttachmentMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

/**
 * `<userId>/<attachmentId>.<ext>`
 *
 * بدء المسار بمعرّف المالك ليس تنظيمًا: سياسة التخزين تقرأ أوّل
 * مقطع وتقارنه بـ`auth.uid()`، وقيدُ `attachments_path_ck` في
 * القاعدة يرفض صفًّا لا يبدأ مساره بمالكه. فالاتّفاق مفروض من
 * طرفين، وهذه الدالة هي الموضع الوحيد الذي يبنيه.
 */
export function buildStoragePath(
  userId: string,
  attachmentId: string,
  mime: AttachmentMime,
): string {
  return `${userId}/${attachmentId}.${EXT[mime]}`;
}

export function createAttachment(args: {
  id: string;
  userId: string;
  transactionId: string;
  file: PickedFile;
  valid: Valid;
  caption?: string;
}): Attachment {
  const { id, userId, transactionId, file, valid, caption } = args;
  return {
    id,
    transactionId,
    kind: valid.kind,
    storagePath: buildStoragePath(userId, id, valid.mimeType),
    mimeType: valid.mimeType,
    byteSize: file.byteSize,
    width: file.width,
    height: file.height,
    caption,
    _localUri: file.uri,
    // ينتظر الرفع، فلا تحمله المزامنة بعد
    _pendingUpload: true,
    _attempts: 0,
  };
}

// ─── التأجيل ─────────────────────────────────────────────────────────

/** تأجيل تصاعديّ بالميلي ثانية. المحاولة الأولى فورًا. */
const BACKOFF_MS = [0, 30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

export const MAX_ATTEMPTS = BACKOFF_MS.length;

export function backoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

/**
 * توقّفنا عن المحاولة.
 *
 * لا نحاول إلى الأبد: ملفٌّ حُذف من الجهاز أو رفضه السيرفر لسببٍ
 * ثابت لن ينجح بالإلحاح، والإلحاح يستهلك بطّارية وبيانات. بعد
 * الاستنفاد يُعرض للمستخدم ليقرّر — إعادة التقاط أو حذف.
 */
export function isExhausted(a: Attachment): boolean {
  return (a._attempts ?? 0) >= MAX_ATTEMPTS;
}

export interface DueOptions {
  now: number;
  /** متى جُرِّب آخر مرّة، بالميلي ثانية */
  lastTriedAt?: Record<string, number>;
  /** سقف ما يُرفع في الجولة الواحدة */
  limit?: number;
}

/**
 * ما يستحقّ الرفع الآن.
 *
 * الأقدم أوّلًا (بعدد المحاولات ثمّ بالمعرّف) حتى لا يتضوّر ملفٌّ
 * جوعًا خلف ملفّات أحدث منه.
 */
export function dueForUpload(
  attachments: Attachment[],
  opts: DueOptions,
): Attachment[] {
  const { now, lastTriedAt = {}, limit = 3 } = opts;

  return attachments
    .filter((a) => a._pendingUpload === true)
    .filter((a) => !!a._localUri)
    .filter((a) => !isExhausted(a))
    .filter((a) => {
      const attempts = a._attempts ?? 0;
      if (attempts === 0) return true;
      const last = lastTriedAt[a.id];
      if (last === undefined) return true;
      return now - last >= backoffMs(attempts);
    })
    .sort((x, y) => (x._attempts ?? 0) - (y._attempts ?? 0) || (x.id < y.id ? -1 : 1))
    .slice(0, limit);
}

// ─── انتقالات الحالة ────────────────────────────────────────────────

/**
 * نجح الرفع: الصفّ يصير قابلًا للمزامنة الآن، لا قبلها.
 *
 * `_localUri` يبقى عن قصد — النسخة المحلّية أسرع من تنزيلها من جديد
 * وتعمل بلا شبكة. تنظيفها شأن إدارة المساحة، لا شأن الرفع.
 */
export function markUploaded(a: Attachment): Attachment {
  return { ...a, _pendingUpload: false, _attempts: 0, _lastError: undefined, _dirty: 1 } as Attachment & {
    _dirty: 1;
  };
}

export function markFailed(a: Attachment, error: string): Attachment {
  return { ...a, _attempts: (a._attempts ?? 0) + 1, _lastError: error };
}
