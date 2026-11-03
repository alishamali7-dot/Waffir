/**
 * رفع الفواتير — غلافُ الإدخال والإخراج فوق [`queue.ts`](queue.ts).
 *
 * كلّ قرار في `queue.ts`، وهذا الملفّ ينفّذ فقط: يقرأ الملفّ، يرفعه،
 * ويحفظ النتيجة. والواجهتان أدناه هما ما يجعله مُختبَرًا بلا جهاز.
 */

import type { Attachment } from '../types';
import {
  dueForUpload,
  isExhausted,
  markFailed,
  markUploaded,
  type DueOptions,
} from './queue';

/** قراءة ملفّ من الجهاز (expo-file-system في التطبيق). */
export interface LocalFiles {
  /** يرجع null لو اختفى الملفّ — المستخدم مسح معرض الصور مثلًا. */
  read(uri: string): Promise<ArrayBuffer | null>;
}

/** تخزين Supabase. */
export interface Bucket {
  upload(
    path: string,
    body: ArrayBuffer,
    opts: { contentType: string; upsert: boolean },
  ): Promise<void>;
}

/** حفظ الحالة بعد كلّ محاولة. */
export interface AttachmentStore {
  save(a: Attachment): Promise<void>;
  /** متى جُرِّب كلّ مرفق آخر مرّة، للتأجيل */
  lastTriedAt(): Promise<Record<string, number>>;
  setLastTried(id: string, at: number): Promise<void>;
}

export interface UploadReport {
  uploaded: string[];
  failed: Array<{ id: string; error: string }>;
  /** استُنفدت محاولاته — يحتاج قرار المستخدم */
  exhausted: string[];
  skipped: number;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * جولة رفع واحدة.
 *
 * تُنادى بعد التقاط فاتورة، وعند عودة الشبكة، ومع كلّ مزامنة. وهي
 * آمنة التكرار: `queue.dueForUpload` يختار المستحقّ وحده، فنداؤها
 * مرّتين لا يرفع شيئًا مرّتين.
 */
export async function uploadPending(
  attachments: Attachment[],
  deps: { files: LocalFiles; bucket: Bucket; store: AttachmentStore },
  opts: Partial<DueOptions> = {},
): Promise<UploadReport> {
  const { files, bucket, store } = deps;
  const now = opts.now ?? Date.now();
  const lastTriedAt = opts.lastTriedAt ?? (await store.lastTriedAt());

  const due = dueForUpload(attachments, { ...opts, now, lastTriedAt });
  const report: UploadReport = {
    uploaded: [],
    failed: [],
    exhausted: [],
    skipped: attachments.filter((a) => a._pendingUpload).length - due.length,
  };

  for (const a of due) {
    await store.setLastTried(a.id, now);
    try {
      const body = await files.read(a._localUri!);

      /**
       * الملفّ اختفى من الجهاز.
       *
       * نستنفد محاولاته فورًا بدل تكرارها: لا عدد من المحاولات
       * يُعيد ملفًّا محذوفًا، والإلحاح هنا بطّاريةٌ تُحرق بلا أمل.
       * ويبقى الصفّ ليقرّر المستخدم.
       */
      if (body === null) {
        const gone = { ...markFailed(a, 'الملفّ لم يعد على الجهاز'), _attempts: 99 };
        await store.save(gone);
        report.exhausted.push(a.id);
        continue;
      }

      /**
       * `upsert: true` مقصود.
       *
       * المسار مشتقّ من معرّف المرفق، فإعادة الرفع تكتب الملفّ نفسه
       * في مكانه نفسه. ولو انقطع الاتصال بعد وصول البايتات وقبل
       * وصول الردّ، تنجح المحاولة التالية بدل أن ترتطم بـ«موجود».
       */
      await bucket.upload(a.storagePath, body, {
        contentType: a.mimeType,
        upsert: true,
      });

      await store.save(markUploaded(a));
      report.uploaded.push(a.id);
    } catch (e) {
      const failed = markFailed(a, message(e));
      await store.save(failed);
      if (isExhausted(failed)) report.exhausted.push(a.id);
      else report.failed.push({ id: a.id, error: message(e) });
    }
  }

  return report;
}

/**
 * محوّل Supabase Storage.
 *
 * الواجهة مُعلَنة محليًّا كبقيّة المحوّلات، فيبقى الملفّ قابلًا
 * للفحص دون تثبيت الحزمة.
 */
export interface MinimalStorage {
  from(bucket: string): {
    upload(
      path: string,
      body: ArrayBuffer,
      opts: { contentType?: string; upsert?: boolean },
    ): Promise<{ error: { message: string } | null }>;
    createSignedUrl(
      path: string,
      expiresIn: number,
    ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  };
}

export const RECEIPTS_BUCKET = 'receipts';

export function supabaseBucket(storage: MinimalStorage): Bucket {
  return {
    async upload(path, body, opts) {
      const { error } = await storage
        .from(RECEIPTS_BUCKET)
        .upload(path, body, { contentType: opts.contentType, upsert: opts.upsert });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * رابط مؤقّت لعرض فاتورة.
 *
 * الـbucket خاصّ، فلا رابط ثابت. والمدّة قصيرة عمدًا: الرابط
 * الموقَّع يعمل لمن يحمله، فإطالته تعني فاتورةً تُقرأ بعد انتهاء
 * الجلسة. ساعةٌ تكفي لعرضٍ وتكبير.
 */
export async function signedReceiptUrl(
  storage: MinimalStorage,
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) throw new Error(error?.message ?? 'تعذّر توقيع الرابط');
  return data.signedUrl;
}
