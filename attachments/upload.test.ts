/**
 * npx tsx --test attachments/upload.test.ts
 *
 * مخازن وهميّة: الرفع يُختبر بلا شبكة ولا جهاز ولا ملفّ حقيقيّ.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Attachment } from '../types';
import { MAX_ATTEMPTS } from './queue';
import {
  uploadPending,
  type AttachmentStore,
  type Bucket,
  type LocalFiles,
} from './upload';

const pending = (id: string, attempts = 0): Attachment => ({
  id,
  transactionId: 'tx',
  kind: 'image',
  storagePath: `uid/${id}.jpg`,
  mimeType: 'image/jpeg',
  byteSize: 1000,
  _localUri: `file:///tmp/${id}.jpg`,
  _pendingUpload: true,
  _attempts: attempts,
});

class Fakes {
  saved = new Map<string, Attachment>();
  tried: Record<string, number> = {};
  uploads: Array<{ path: string; contentType: string; upsert: boolean }> = [];
  missing = new Set<string>();
  failWith: string | null = null;

  files: LocalFiles = {
    read: async (uri) => (this.missing.has(uri) ? null : new ArrayBuffer(8)),
  };

  bucket: Bucket = {
    upload: async (path, _body, opts) => {
      if (this.failWith) throw new Error(this.failWith);
      this.uploads.push({ path, contentType: opts.contentType, upsert: opts.upsert });
    },
  };

  store: AttachmentStore = {
    save: async (a) => void this.saved.set(a.id, a),
    lastTriedAt: async () => this.tried,
    setLastTried: async (id, at) => void (this.tried[id] = at),
  };

  get deps() {
    return { files: this.files, bucket: this.bucket, store: this.store };
  }
}

// ─── المسار السعيد ──────────────────────────────────────────────────

test('يرفع المنتظِر ويجعل صفّه قابلًا للمزامنة', async () => {
  const f = new Fakes();
  const r = await uploadPending([pending('a')], f.deps, { now: 1000 });

  assert.deepEqual(r.uploaded, ['a']);
  assert.deepEqual(r.failed, []);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.uploads[0].path, 'uid/a.jpg');
  assert.equal(f.uploads[0].contentType, 'image/jpeg');

  const after = f.saved.get('a') as Attachment & { _dirty?: number };
  assert.equal(after._pendingUpload, false);
  assert.equal(after._dirty, 1, 'الآن فقط تحمله المزامنة');
});

test('upsert مفعّل — إعادة الرفع تكتب مكانها لا تصطدم', async () => {
  const f = new Fakes();
  await uploadPending([pending('a')], f.deps, { now: 1000 });
  assert.equal(f.uploads[0].upsert, true);
});

test('النداء مرّتين لا يرفع مرّتين', async () => {
  const f = new Fakes();
  const a = pending('a');
  await uploadPending([a], f.deps, { now: 1000 });
  // الحالة بعد النجاح هي ما تُقرأ في الجولة التالية
  const after = f.saved.get('a')!;
  await uploadPending([after], f.deps, { now: 2000 });
  assert.equal(f.uploads.length, 1);
});

// ─── الإخفاقات ──────────────────────────────────────────────────────

test('الملفّ المفقود يُستنفد فورًا — لا محاولات بلا أمل', async () => {
  const f = new Fakes();
  f.missing.add('file:///tmp/a.jpg');

  const r = await uploadPending([pending('a')], f.deps, { now: 1000 });

  assert.deepEqual(r.exhausted, ['a']);
  assert.deepEqual(r.uploaded, []);
  assert.equal(f.uploads.length, 0, 'ما حاول الرفع أصلًا');
  const after = f.saved.get('a')!;
  assert.ok((after._attempts ?? 0) >= MAX_ATTEMPTS, 'لا يعود للطابور');
  assert.match(after._lastError ?? '', /لم يعد على الجهاز/);
});

test('فشل الشبكة يزيد العدّاد ويبقي الصفّ منتظِرًا', async () => {
  const f = new Fakes();
  f.failWith = 'network timeout';

  const r = await uploadPending([pending('a')], f.deps, { now: 1000 });

  assert.deepEqual(r.uploaded, []);
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].id, 'a');
  const after = f.saved.get('a')!;
  assert.equal(after._attempts, 1);
  assert.equal(after._pendingUpload, true);
  assert.equal((after as Record<string, unknown>)._dirty, undefined, 'لا يُزامَن صفٌّ بلا ملفّ');
});

test('الفشل المتكرّر ينتهي بالاستنفاد لا بحلقة', async () => {
  const f = new Fakes();
  f.failWith = 'boom';
  let a = pending('a', MAX_ATTEMPTS - 1);

  const r = await uploadPending([a], f.deps, { now: 1e12 });

  assert.deepEqual(r.exhausted, ['a']);
  assert.deepEqual(r.failed, []);
});

test('فشل مرفق لا يمنع رفع غيره', async () => {
  const f = new Fakes();
  f.missing.add('file:///tmp/a.jpg');

  const r = await uploadPending([pending('a'), pending('b')], f.deps, { now: 1000 });

  assert.deepEqual(r.uploaded, ['b']);
  assert.deepEqual(r.exhausted, ['a']);
});

// ─── الاستحقاق والتأجيل ─────────────────────────────────────────────

test('يسجّل وقت المحاولة ليُحسب التأجيل عليه', async () => {
  const f = new Fakes();
  f.failWith = 'boom';
  await uploadPending([pending('a')], f.deps, { now: 7777 });
  assert.equal(f.tried['a'], 7777);
});

test('المؤجَّل لا يُحاوَل، ويُحسب skipped', async () => {
  const f = new Fakes();
  f.tried = { a: 1_000_000 };
  const r = await uploadPending([pending('a', 3)], f.deps, { now: 1_000_001 });

  assert.deepEqual(r.uploaded, []);
  assert.equal(f.uploads.length, 0);
  assert.equal(r.skipped, 1);
});

test('السقف يحدّ الجولة، والباقي يُعدّ متروكًا', async () => {
  const f = new Fakes();
  const many = Array.from({ length: 5 }, (_, i) => pending(`a${i}`));
  const r = await uploadPending(many, f.deps, { now: 1000, limit: 2 });

  assert.equal(r.uploaded.length, 2);
  assert.equal(r.skipped, 3);
});

test('لا شي منتظِر = لا قراءة ولا رفع', async () => {
  const f = new Fakes();
  const done: Attachment = { ...pending('a'), _pendingUpload: false };
  const r = await uploadPending([done], f.deps, { now: 1000 });

  assert.deepEqual(r.uploaded, []);
  assert.equal(f.uploads.length, 0);
  assert.equal(r.skipped, 0);
});
