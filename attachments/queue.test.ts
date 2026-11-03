/**
 * npx tsx --test attachments/queue.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_ATTACHMENT_BYTES, type Attachment } from '../types';
import {
  MAX_ATTEMPTS,
  backoffMs,
  buildStoragePath,
  createAttachment,
  dueForUpload,
  isExhausted,
  markFailed,
  markUploaded,
  validate,
  type PickedFile,
} from './queue';

const UID = '0a000000-0000-4000-8000-00000000000a';

const file = (over: Partial<PickedFile> = {}): PickedFile => ({
  uri: 'file:///tmp/a.jpg',
  mimeType: 'image/jpeg',
  byteSize: 204_800,
  ...over,
});

const pending = (id: string, attempts = 0): Attachment => ({
  id,
  transactionId: 'tx',
  kind: 'image',
  storagePath: `${UID}/${id}.jpg`,
  mimeType: 'image/jpeg',
  byteSize: 1000,
  _localUri: 'file:///tmp/a.jpg',
  _pendingUpload: true,
  _attempts: attempts,
});

// ─── التحقّق ────────────────────────────────────────────────────────

test('صورة سليمة تمرّ', () => {
  const v = validate(file());
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.kind, 'image');
    assert.equal(v.mimeType, 'image/jpeg');
  }
});

test('PDF يصير kind=pdf لا image', () => {
  const v = validate(file({ mimeType: 'application/pdf' }));
  assert.equal(v.ok && v.kind, 'pdf');
});

test('الحدّ: المساوي يمرّ والزائد يُرفض', () => {
  assert.equal(validate(file({ byteSize: MAX_ATTACHMENT_BYTES })).ok, true);
  const over = validate(file({ byteSize: MAX_ATTACHMENT_BYTES + 1 }));
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.reason, 'too_large');
});

test('الملفّ الفارغ يُرفض — صفر بايت ليس فاتورة', () => {
  const v = validate(file({ byteSize: 0 }));
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, 'empty');
});

test('نوع غير مسموح يُرفض', () => {
  const v = validate(file({ mimeType: 'application/x-msdownload' }));
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.reason, 'bad_mime');
});

test('mime بمعاملات وحالة أحرف مختلفة يُقبل', () => {
  // الكاميرا قد تعطي "image/JPEG; charset=binary"
  const v = validate(file({ mimeType: 'image/JPEG; charset=binary' }));
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.mimeType, 'image/jpeg');
});

// ─── المسار ─────────────────────────────────────────────────────────

test('المسار يبدأ بالمالك — القاعدة والتخزين يفرضانه', () => {
  const p = buildStoragePath(UID, 'abc', 'image/jpeg');
  assert.equal(p, `${UID}/abc.jpg`);
  assert.ok(p.startsWith(UID + '/'));
});

test('الامتداد يتبع الـmime لا اسم الملفّ', () => {
  assert.ok(buildStoragePath(UID, 'x', 'application/pdf').endsWith('.pdf'));
  assert.ok(buildStoragePath(UID, 'x', 'image/webp').endsWith('.webp'));
  assert.ok(buildStoragePath(UID, 'x', 'image/heic').endsWith('.heic'));
});

// ─── الإنشاء ────────────────────────────────────────────────────────

test('المرفق يُولد منتظِرًا للرفع — فلا تحمله المزامنة بعد', () => {
  const v = validate(file());
  assert.ok(v.ok);
  const a = createAttachment({
    id: 'a1',
    userId: UID,
    transactionId: 'tx1',
    file: file(),
    valid: v,
  });
  assert.equal(a._pendingUpload, true);
  assert.equal(a._attempts, 0);
  assert.equal(a._localUri, 'file:///tmp/a.jpg');
  assert.equal(a.storagePath, `${UID}/a1.jpg`);
  // الصفّ ليس dirty: الملفّ أوّلًا
  assert.equal((a as Record<string, unknown>)._dirty, undefined);
});

// ─── التأجيل ────────────────────────────────────────────────────────

test('المحاولة الأولى فورًا، ثمّ يتصاعد التأجيل', () => {
  assert.equal(backoffMs(0), 0);
  let prev = -1;
  // يتصاعد حتى آخر درجة
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    const ms = backoffMs(i);
    assert.ok(ms > prev, `المحاولة ${i} ليست أطول`);
    prev = ms;
  }
});

test('التأجيل يثبت عند سقفه ولا ينمو بلا حدّ', () => {
  // وإلّا صار الانتظار أيّامًا ثمّ أسابيع، وهو انتظارٌ لا يراه أحد
  const ceiling = backoffMs(MAX_ATTEMPTS - 1);
  assert.equal(backoffMs(MAX_ATTEMPTS), ceiling);
  assert.equal(backoffMs(99), ceiling);
});

test('الاستنفاد يوقف المحاولة', () => {
  assert.equal(isExhausted(pending('a', MAX_ATTEMPTS - 1)), false);
  assert.equal(isExhausted(pending('a', MAX_ATTEMPTS)), true);
});

// ─── الاستحقاق ──────────────────────────────────────────────────────

test('الجديد يُرفع فورًا', () => {
  const due = dueForUpload([pending('a')], { now: 1000 });
  assert.deepEqual(due.map((d) => d.id), ['a']);
});

test('المرفوع أصلًا لا يُعاد', () => {
  const done: Attachment = { ...pending('a'), _pendingUpload: false };
  assert.deepEqual(dueForUpload([done], { now: 1000 }), []);
});

test('بلا ملفّ محلّيّ لا يُحاوَل — لا شي نرفعه', () => {
  const gone: Attachment = { ...pending('a'), _localUri: undefined };
  assert.deepEqual(dueForUpload([gone], { now: 1000 }), []);
});

test('المستنفَد يخرج من الطابور', () => {
  assert.deepEqual(dueForUpload([pending('a', MAX_ATTEMPTS)], { now: 1e9 }), []);
});

test('الفاشل ينتظر تأجيله ثمّ يعود', () => {
  const a = pending('a', 1);
  const last = 1_000_000;
  const tooSoon = dueForUpload([a], { now: last + backoffMs(1) - 1, lastTriedAt: { a: last } });
  assert.deepEqual(tooSoon, []);
  const ready = dueForUpload([a], { now: last + backoffMs(1), lastTriedAt: { a: last } });
  assert.deepEqual(ready.map((d) => d.id), ['a']);
});

test('الأقلّ محاولاتٍ أوّلًا — لا يتضوّر ملفّ خلف أحدث منه', () => {
  const due = dueForUpload([pending('c', 2), pending('a', 0), pending('b', 1)], {
    now: 1e9,
    limit: 3,
  });
  assert.deepEqual(due.map((d) => d.id), ['a', 'b', 'c']);
});

test('السقف يحدّ الجولة الواحدة', () => {
  const many = Array.from({ length: 10 }, (_, i) => pending(`a${i}`));
  assert.equal(dueForUpload(many, { now: 1e9, limit: 3 }).length, 3);
});

// ─── الانتقالات ─────────────────────────────────────────────────────

test('النجاح يجعل الصفّ قابلًا للمزامنة — لا قبله', () => {
  const after = markUploaded(pending('a', 2)) as Attachment & { _dirty?: number };
  assert.equal(after._pendingUpload, false);
  assert.equal(after._dirty, 1, 'الآن تحمله المزامنة');
  assert.equal(after._attempts, 0);
  assert.equal(after._lastError, undefined);
});

test('النسخة المحلّية تبقى بعد الرفع — أسرع من تنزيلها', () => {
  assert.equal(markUploaded(pending('a'))._localUri, 'file:///tmp/a.jpg');
});

test('الفشل يزيد العدّاد ويحفظ السبب ويبقي الانتظار', () => {
  const after = markFailed(pending('a', 1), 'network timeout');
  assert.equal(after._attempts, 2);
  assert.equal(after._lastError, 'network timeout');
  assert.equal(after._pendingUpload, true);
});

test('الفشل المتكرّر ينتهي بالاستنفاد لا بحلقة أبدية', () => {
  let a = pending('a');
  for (let i = 0; i < MAX_ATTEMPTS; i++) a = markFailed(a, 'boom');
  assert.ok(isExhausted(a));
  assert.deepEqual(dueForUpload([a], { now: 1e12 }), []);
});
