/**
 * التقاط الفاتورة: كاميرا، معرض، أو ملفّ PDF.
 *
 * يحتاج:
 *   npx expo install expo-image-picker expo-document-picker expo-image-manipulator
 *
 * الواجهات أدناه مُعلَنة محليًّا كبقيّة المحوّلات، فيبقى الملفّ
 * قابلًا للفحص والاختبار دون تثبيت الحزم.
 */

import { ALLOWED_ATTACHMENT_MIME, type AttachmentMime } from '../types';
import { validate, type PickedFile, type Invalid, type Valid } from './queue';

// ─── الضغط ───────────────────────────────────────────────────────────

/**
 * صورة الهاتف ٤ ميجابايت، والفاتورة نصّ أسود على ورق أبيض.
 *
 * رفعُها كما هي يُهدر بيانات المستخدم ووقته بلا فائدة: ١٦٠٠ بكسل
 * تكفي لقراءة أصغر سطر في الفاتورة، وتُنزل الحجم إلى مئات الكيلوبايت.
 * (فاتورة العيّنة: ٢٫٤ ميجا ← ٩٣ كيلو بلا فقدٍ يُلحظ.)
 *
 * الـPDF لا يُضغط: هو نصّ متجّه أصلًا، وإعادة ترميزه تُفسده.
 */
export const COMPRESS_MAX_EDGE = 1600;
export const COMPRESS_QUALITY = 0.72;
/** أصغر من هذا لا يستحقّ إعادة الترميز */
export const COMPRESS_MIN_BYTES = 300 * 1024;

export function shouldCompress(mime: string, byteSize: number): boolean {
  if (mime === 'application/pdf') return false;
  return byteSize >= COMPRESS_MIN_BYTES;
}

// ─── استنتاج النوع ───────────────────────────────────────────────────

const BY_EXT: Record<string, AttachmentMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  pdf: 'application/pdf',
};

/**
 * النوع من المنتقي أوّلًا، ومن الامتداد عند غيابه.
 *
 * `expo-image-picker` لا يعطي `mimeType` في كلّ إصدار ولا على كلّ
 * منصّة، وبدون استنتاجٍ احتياطيّ يسقط الالتقاط بـ«نوع غير مسموح»
 * على أجهزة بعينها — وهو عطل يظهر عند المستخدم لا عندك.
 */
export function inferMime(uri: string, provided?: string | null): string {
  const given = (provided ?? '').toLowerCase().split(';')[0].trim();
  if ((ALLOWED_ATTACHMENT_MIME as readonly string[]).includes(given)) return given;

  // نقطع أيّ ?query أو #hash قبل قراءة الامتداد
  const clean = uri.split(/[?#]/)[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  // `given || …` لا `given ?? …`: الفراغ قيمةٌ موجودة فلا يتخطّاها
  // `??`، فكان المجهول يرجع '' ويظهر للمستخدم نوعٌ فارغ في الرسالة.
  return BY_EXT[ext] ?? (given || 'application/octet-stream');
}

// ─── واجهات الحزم ────────────────────────────────────────────────────

export interface PickerAsset {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
  fileName?: string | null;
}

export interface MinimalImagePicker {
  requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  launchCameraAsync(opts: {
    quality: number;
    exif: boolean;
  }): Promise<{ canceled: boolean; assets?: PickerAsset[] | null }>;
  launchImageLibraryAsync(opts: {
    quality: number;
    exif: boolean;
  }): Promise<{ canceled: boolean; assets?: PickerAsset[] | null }>;
}

export interface MinimalDocumentPicker {
  getDocumentAsync(opts: {
    type: string | string[];
    copyToCacheDirectory: boolean;
  }): Promise<{ canceled: boolean; assets?: PickerAsset[] | null }>;
}

export interface MinimalManipulator {
  manipulateAsync(
    uri: string,
    actions: Array<{ resize: { width?: number; height?: number } }>,
    opts: { compress: number; format: 'jpeg' },
  ): Promise<{ uri: string; width: number; height: number }>;
}

export interface MinimalFileInfo {
  /** حجم الملفّ بعد المعالجة — المنتقي لا يعطيه دائمًا */
  sizeOf(uri: string): Promise<number>;
}

export interface CaptureDeps {
  images: MinimalImagePicker;
  documents: MinimalDocumentPicker;
  manipulator: MinimalManipulator;
  fileInfo: MinimalFileInfo;
}

// ─── النتيجة ─────────────────────────────────────────────────────────

export type CaptureResult =
  | { status: 'picked'; file: PickedFile; valid: Valid }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'rejected'; problem: Invalid };

/** يحوّل أصل المنتقي إلى ملفّ، مع ضغطٍ للصور الكبيرة. */
async function toPickedFile(
  asset: PickerAsset,
  deps: CaptureDeps,
): Promise<PickedFile> {
  const mime = inferMime(asset.uri, asset.mimeType);
  let { uri, width, height } = asset;
  let byteSize = asset.fileSize ?? (await deps.fileInfo.sizeOf(asset.uri));

  if (shouldCompress(mime, byteSize)) {
    const longest = Math.max(width ?? 0, height ?? 0);
    const out = await deps.manipulator.manipulateAsync(
      uri,
      // نقيّد الضلع الأطول فقط، فتُحفظ النسبة ولا تُمطّ الفاتورة
      longest > COMPRESS_MAX_EDGE
        ? [{ resize: (width ?? 0) >= (height ?? 0)
              ? { width: COMPRESS_MAX_EDGE }
              : { height: COMPRESS_MAX_EDGE } }]
        : [],
      { compress: COMPRESS_QUALITY, format: 'jpeg' },
    );
    uri = out.uri;
    width = out.width;
    height = out.height;
    byteSize = await deps.fileInfo.sizeOf(out.uri);
  }

  return {
    uri,
    // بعد الضغط يصير النوع jpeg مهما كان الأصل (HEIC مثلًا)
    mimeType: shouldCompress(mime, asset.fileSize ?? byteSize) ? 'image/jpeg' : mime,
    byteSize,
    width,
    height,
  };
}

async function finish(
  asset: PickerAsset | undefined,
  deps: CaptureDeps,
): Promise<CaptureResult> {
  if (!asset) return { status: 'canceled' };
  const file = await toPickedFile(asset, deps);
  const v = validate(file);
  return v.ok ? { status: 'picked', file, valid: v } : { status: 'rejected', problem: v };
}

// ─── المداخل الثلاثة ─────────────────────────────────────────────────

/**
 * الكاميرا.
 *
 * الإذن يُطلب هنا ويُعاد رفضه كحالة، لا كاستثناء: رفض الإذن تصرّفٌ
 * عاديّ من المستخدم لا عطل، والواجهة تحتاج أن تشرح له كيف يتراجع
 * بدل أن تُظهر شاشة خطأ.
 */
export async function captureFromCamera(deps: CaptureDeps): Promise<CaptureResult> {
  const perm = await deps.images.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };

  // quality: 1 عند الالتقاط ثمّ نضغط نحن: الضغط مرّتين يُفقد نصًّا
  // صغيرًا في الفاتورة، والضغطة الواحدة المحسوبة أوضح.
  const res = await deps.images.launchCameraAsync({ quality: 1, exif: false });
  if (res.canceled) return { status: 'canceled' };
  return finish(res.assets?.[0], deps);
}

export async function pickFromLibrary(deps: CaptureDeps): Promise<CaptureResult> {
  const res = await deps.images.launchImageLibraryAsync({ quality: 1, exif: false });
  if (res.canceled) return { status: 'canceled' };
  return finish(res.assets?.[0], deps);
}

/**
 * ملفّ PDF.
 *
 * يُرفق ولا يُقرأ: لا استخراج نصّ ولا مبلغ. هذا قرار المالك، وهو ما
 * يفصل «إرفاق فاتورة» عن «استيراد كشف» المرفوض (راجع INTEGRATION.md).
 */
export async function pickPdf(deps: CaptureDeps): Promise<CaptureResult> {
  const res = await deps.documents.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  if (res.canceled) return { status: 'canceled' };
  return finish(res.assets?.[0], deps);
}

// ─── رسالة الرفض ─────────────────────────────────────────────────────

/** نصّ يفهمه المستخدم، لا رمز خطأ. */
export function rejectionMessage(p: Invalid, lang: 'ar' | 'en'): string {
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
  if (lang === 'ar') {
    switch (p.reason) {
      case 'empty':
        return 'الملفّ فارغ';
      case 'too_large':
        return `الملفّ ${mb(p.byteSize)} ميجابايت، والحدّ ${mb(p.max)}`;
      case 'bad_mime':
        return 'نوع غير مدعوم — صورة أو PDF فقط';
    }
  }
  switch (p.reason) {
    case 'empty':
      return 'That file is empty';
    case 'too_large':
      return `That file is ${mb(p.byteSize)} MB; the limit is ${mb(p.max)} MB`;
    case 'bad_mime':
      return 'Unsupported type — images or PDF only';
  }
}
