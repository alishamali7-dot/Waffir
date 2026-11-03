/**
 * npx tsx --test attachments/capture.test.ts
 *
 * منتقون وهميّون: الالتقاط يُختبر بلا كاميرا ولا جهاز.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_ATTACHMENT_BYTES } from '../types';
import {
  COMPRESS_MAX_EDGE,
  COMPRESS_MIN_BYTES,
  captureFromCamera,
  inferMime,
  pickFromLibrary,
  pickPdf,
  rejectionMessage,
  shouldCompress,
  type CaptureDeps,
  type PickerAsset,
} from './capture';

// ─── استنتاج النوع ──────────────────────────────────────────────────

test('النوع من المنتقي حين يعطيه', () => {
  assert.equal(inferMime('file:///x.bin', 'image/png'), 'image/png');
  assert.equal(inferMime('file:///x.bin', 'image/PNG; charset=b'), 'image/png');
});

test('ومن الامتداد حين لا يعطيه — وهذا يحصل فعلًا على بعض الأجهزة', () => {
  assert.equal(inferMime('file:///a/b/photo.JPG', null), 'image/jpeg');
  assert.equal(inferMime('file:///a/b/scan.pdf', undefined), 'application/pdf');
  assert.equal(inferMime('file:///a/b/img.heic'), 'image/heic');
  assert.equal(inferMime('file:///a/b/img.heif'), 'image/heic');
});

test('الاستعلام والهاش لا يفسدان الامتداد', () => {
  assert.equal(inferMime('content://media/1/photo.jpg?width=99', null), 'image/jpeg');
  assert.equal(inferMime('file:///x/a.png#frag', null), 'image/png');
});

test('نوع المنتقي غير المسموح لا يتقدّم على الامتداد', () => {
  // بعض المنصّات تعطي octet-stream لصورة سليمة
  assert.equal(inferMime('file:///x/a.jpg', 'application/octet-stream'), 'image/jpeg');
});

test('المجهول تمامًا يبقى مجهولًا فيرفضه التحقّق', () => {
  assert.equal(inferMime('file:///x/a.xyz', null), 'application/octet-stream');
});

// ─── قرار الضغط ─────────────────────────────────────────────────────

test('الـPDF لا يُضغط أبدًا — إعادة ترميزه تفسده', () => {
  assert.equal(shouldCompress('application/pdf', 9 * 1024 * 1024), false);
});

test('الصورة الكبيرة تُضغط والصغيرة لا', () => {
  assert.equal(shouldCompress('image/jpeg', COMPRESS_MIN_BYTES), true);
  assert.equal(shouldCompress('image/jpeg', COMPRESS_MIN_BYTES - 1), false);
});

// ─── منتقون وهميّون ─────────────────────────────────────────────────

class Fakes {
  asset: PickerAsset | null = {
    uri: 'file:///tmp/photo.jpg',
    mimeType: 'image/jpeg',
    fileSize: 4 * 1024 * 1024,
    width: 3000,
    height: 4000,
  };
  canceled = false;
  cameraGranted = true;
  resizes: Array<{ width?: number; height?: number }> = [];
  sizes: Record<string, number> = { 'file:///tmp/out.jpg': 180 * 1024 };

  images = {
    requestCameraPermissionsAsync: async () => ({ granted: this.cameraGranted }),
    launchCameraAsync: async () => ({
      canceled: this.canceled,
      assets: this.asset ? [this.asset] : null,
    }),
    launchImageLibraryAsync: async () => ({
      canceled: this.canceled,
      assets: this.asset ? [this.asset] : null,
    }),
  };

  documents = {
    getDocumentAsync: async () => ({
      canceled: this.canceled,
      assets: this.asset ? [this.asset] : null,
    }),
  };

  manipulator = {
    manipulateAsync: async (
      _uri: string,
      actions: Array<{ resize: { width?: number; height?: number } }>,
    ) => {
      for (const a of actions) this.resizes.push(a.resize);
      return { uri: 'file:///tmp/out.jpg', width: 1200, height: 1600 };
    },
  };

  fileInfo = { sizeOf: async (uri: string) => this.sizes[uri] ?? 1000 };

  get deps(): CaptureDeps {
    return {
      images: this.images,
      documents: this.documents,
      manipulator: this.manipulator,
      fileInfo: this.fileInfo,
    };
  }
}

// ─── الكاميرا ───────────────────────────────────────────────────────

test('رفض إذن الكاميرا حالةٌ لا عطل', async () => {
  const f = new Fakes();
  f.cameraGranted = false;
  const r = await captureFromCamera(f.deps);
  assert.equal(r.status, 'denied');
});

test('الإلغاء حالةٌ أيضًا', async () => {
  const f = new Fakes();
  f.canceled = true;
  assert.equal((await captureFromCamera(f.deps)).status, 'canceled');
  assert.equal((await pickFromLibrary(f.deps)).status, 'canceled');
  assert.equal((await pickPdf(f.deps)).status, 'canceled');
});

test('صورة كبيرة: تُضغط ويُقيَّد ضلعها الأطول فتُحفظ النسبة', async () => {
  const f = new Fakes();
  const r = await captureFromCamera(f.deps);

  assert.equal(r.status, 'picked');
  if (r.status !== 'picked') return;
  // الارتفاع أكبر (3000x4000) فيُقيَّد الارتفاع لا العرض
  assert.deepEqual(f.resizes, [{ height: COMPRESS_MAX_EDGE }]);
  assert.equal(r.file.uri, 'file:///tmp/out.jpg');
  assert.equal(r.file.byteSize, 180 * 1024);
  assert.ok(r.file.byteSize < 4 * 1024 * 1024, 'صغُرت فعلًا');
});

test('الصورة العريضة يُقيَّد عرضها', async () => {
  const f = new Fakes();
  f.asset = { ...f.asset!, width: 4000, height: 3000 };
  await captureFromCamera(f.deps);
  assert.deepEqual(f.resizes, [{ width: COMPRESS_MAX_EDGE }]);
});

test('HEIC يصير jpeg بعد الضغط — لا يبقى نوعًا تعجز عنه المتصفّحات', async () => {
  const f = new Fakes();
  f.asset = { ...f.asset!, uri: 'file:///tmp/p.heic', mimeType: 'image/heic' };
  const r = await captureFromCamera(f.deps);
  assert.equal(r.status === 'picked' && r.file.mimeType, 'image/jpeg');
});

test('الصورة الصغيرة تمرّ بلا إعادة ترميز', async () => {
  const f = new Fakes();
  f.asset = { ...f.asset!, fileSize: 80 * 1024, width: 900, height: 1200 };
  const r = await captureFromCamera(f.deps);

  assert.deepEqual(f.resizes, [], 'ما استُدعي التحجيم');
  assert.equal(r.status === 'picked' && r.file.uri, 'file:///tmp/photo.jpg');
});

test('الكبيرة دون الحدّ البعدي تُضغط بلا تحجيم', async () => {
  const f = new Fakes();
  // ثقيلة لكن أبعادها صغيرة: جودةٌ تُخفَّض، وأبعادٌ تُترك
  f.asset = { ...f.asset!, fileSize: 2 * 1024 * 1024, width: 1000, height: 1200 };
  await captureFromCamera(f.deps);
  assert.deepEqual(f.resizes, [], 'لا تحجيم');
});

// ─── المكتبة و PDF ──────────────────────────────────────────────────

test('المكتبة لا تطلب إذن الكاميرا', async () => {
  const f = new Fakes();
  f.cameraGranted = false;
  const r = await pickFromLibrary(f.deps);
  assert.equal(r.status, 'picked');
});

test('PDF يمرّ كما هو: لا ضغط ولا تحويل', async () => {
  const f = new Fakes();
  f.asset = {
    uri: 'file:///tmp/invoice.pdf',
    mimeType: 'application/pdf',
    fileSize: 2 * 1024 * 1024,
  };
  const r = await pickPdf(f.deps);

  assert.equal(r.status, 'picked');
  if (r.status !== 'picked') return;
  assert.equal(r.file.mimeType, 'application/pdf');
  assert.equal(r.file.uri, 'file:///tmp/invoice.pdf');
  assert.deepEqual(f.resizes, []);
});

// ─── الرفض ──────────────────────────────────────────────────────────

test('الملفّ فوق الحدّ يُرفض برسالة مفهومة', async () => {
  const f = new Fakes();
  f.asset = {
    uri: 'file:///tmp/huge.pdf',
    mimeType: 'application/pdf',
    fileSize: MAX_ATTACHMENT_BYTES + 1,
  };
  const r = await pickPdf(f.deps);

  assert.equal(r.status, 'rejected');
  if (r.status !== 'rejected') return;
  assert.equal(r.problem.reason, 'too_large');
  const ar = rejectionMessage(r.problem, 'ar');
  assert.match(ar, /١٠|10/);
  assert.ok(!/undefined|NaN/.test(ar));
  assert.ok(!/undefined|NaN/.test(rejectionMessage(r.problem, 'en')));
});

test('النوع غير المدعوم يُرفض', async () => {
  const f = new Fakes();
  f.asset = { uri: 'file:///tmp/a.docx', mimeType: null, fileSize: 1000 };
  const r = await pickPdf(f.deps);
  assert.equal(r.status === 'rejected' && r.problem.reason, 'bad_mime');
});

test('رسائل الرفض كاملة في اللغتين', () => {
  const cases = [
    { ok: false, reason: 'empty' },
    { ok: false, reason: 'too_large', byteSize: 2e7, max: MAX_ATTACHMENT_BYTES },
    { ok: false, reason: 'bad_mime', mimeType: 'x/y' },
  ] as const;
  for (const c of cases) {
    for (const lang of ['ar', 'en'] as const) {
      const m = rejectionMessage(c, lang);
      assert.ok(m.length > 5, `${c.reason}/${lang}`);
      assert.ok(!/undefined/.test(m));
    }
  }
});
