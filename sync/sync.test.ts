/**
 * npx tsx --test sync/sync.test.ts
 *
 * مخزنان وهميّان في الذاكرة. ما يُختبر هنا هو ما يتلف البيانات فعلًا:
 * الترتيب، وعلم `_dirty`، وتقدّم المؤشّر، وعزل الصفّ المرفوض.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TABLE_ORDER, type LocalRow, type SyncRow, type SyncTable } from './plan';
import type { LocalStore, RemoteStore } from './store';
import { PULL_PAGE, pullTable, pushTable, syncAll } from './sync';

// ─── مخزن محلّي وهميّ ───────────────────────────────────────────────

class FakeLocal implements LocalStore {
  rows = new Map<SyncTable, Map<string, LocalRow>>();
  cursors = new Map<SyncTable, string>();
  log: string[] = [];

  private t(table: SyncTable) {
    let m = this.rows.get(table);
    if (!m) {
      m = new Map();
      this.rows.set(table, m);
    }
    return m;
  }

  seed(table: SyncTable, rows: LocalRow[]) {
    for (const r of rows) this.t(table).set(r.id, { ...r });
    return this;
  }

  async getCursor(table: SyncTable) {
    return this.cursors.get(table) ?? null;
  }

  async setCursor(table: SyncTable, cursor: string) {
    this.cursors.set(table, cursor);
  }

  async dirtyRows(table: SyncTable) {
    return [...this.t(table).values()].filter((r) => r._dirty === 1);
  }

  async markClean(table: SyncTable, serverRows: SyncRow[]) {
    this.log.push(`markClean:${table}:${serverRows.length}`);
    for (const s of serverRows) {
      const cur = this.t(table).get(s.id);
      if (cur) this.t(table).set(s.id, { ...cur, updated_at: s.updated_at, _dirty: 0 });
    }
  }

  async getByIds(table: SyncTable, ids: string[]) {
    const out = new Map<string, LocalRow>();
    for (const id of ids) {
      const r = this.t(table).get(id);
      if (r) out.set(id, r);
    }
    return out;
  }

  async upsertFromRemote(table: SyncTable, rows: SyncRow[]) {
    this.log.push(`pull:${table}:${rows.length}`);
    for (const r of rows) this.t(table).set(r.id, { ...(r as LocalRow), _dirty: 0 });
  }

  get(table: SyncTable, id: string) {
    return this.t(table).get(id);
  }
}

// ─── مخزن بعيد وهميّ ────────────────────────────────────────────────

class FakeRemote implements RemoteStore {
  rows = new Map<SyncTable, Map<string, SyncRow>>();
  log: string[] = [];
  private tick = 0;
  /** صفّ يرفضه السيرفر */
  reject: (table: SyncTable, row: Record<string, unknown>) => string | null = () => null;
  /** جدول يسقط الاتصال عنده */
  failTable: SyncTable | null = null;

  private t(table: SyncTable) {
    let m = this.rows.get(table);
    if (!m) {
      m = new Map();
      this.rows.set(table, m);
    }
    return m;
  }

  /** ساعة السيرفر: بدقّة ميكروثانية، مستقلّة عن ساعة الجهاز */
  stamp() {
    this.tick++;
    return `2026-11-03T12:00:00.${String(this.tick).padStart(6, '0')}+00:00`;
  }

  seed(table: SyncTable, rows: SyncRow[]) {
    for (const r of rows) this.t(table).set(r.id, { ...r });
    return this;
  }

  async push(table: SyncTable, rows: Record<string, unknown>[]) {
    this.log.push(`push:${table}:${rows.length}`);
    if (this.failTable === table) throw new Error('الشبكة انقطعت');
    for (const r of rows) {
      const why = this.reject(table, r);
      if (why) throw new Error(why); // الدفعة كلّها تفشل، كما يفعل upsert
    }
    const back: SyncRow[] = rows.map((r) => ({
      ...(r as object),
      id: String(r.id),
      updated_at: this.stamp(),
    }) as SyncRow);
    for (const r of back) this.t(table).set(r.id, r);
    return back;
  }

  async pull(table: SyncTable, since: string | null, limit: number) {
    this.log.push(`pull:${table}`);
    if (this.failTable === table) throw new Error('الشبكة انقطعت');
    return [...this.t(table).values()]
      .filter((r) => since === null || r.updated_at >= since)
      .sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1))
      .slice(0, limit);
  }
}

const row = (id: string, dirty: 0 | 1, updated = '2026-01-01T00:00:00.000000+00:00'): LocalRow => ({
  id,
  updated_at: updated,
  _dirty: dirty,
  name: `row-${id}`,
});

// ─── الدفع ──────────────────────────────────────────────────────────

test('يدفع المعدَّل فقط، ويترك النظيف', async () => {
  const local = new FakeLocal().seed('accounts', [
    row('a', 1),
    row('b', 0),
    row('c', 1),
  ]);
  const remote = new FakeRemote();

  const { pushed, rejected } = await pushTable(local, remote, 'accounts');

  assert.equal(pushed, 2);
  assert.deepEqual(rejected, []);
  assert.deepEqual(remote.log, ['push:accounts:2']);
  assert.ok(!remote.rows.get('accounts')!.has('b'), 'النظيف لم يُدفع');
});

test('بعد الدفع: _dirty يُمسح و updated_at يصير طابع السيرفر', async () => {
  const local = new FakeLocal().seed('accounts', [row('a', 1, '1999-01-01T00:00:00+00:00')]);
  const remote = new FakeRemote();

  await pushTable(local, remote, 'accounts');

  const after = local.get('accounts', 'a')!;
  assert.equal(after._dirty, 0);
  assert.notEqual(after.updated_at, '1999-01-01T00:00:00+00:00');
  assert.equal(after.updated_at, remote.rows.get('accounts')!.get('a')!.updated_at);
});

test('الأعمدة المحلّية لا تُرسل', async () => {
  const local = new FakeLocal();
  local.seed('accounts', [{ ...row('a', 1), _lastError: 'x' } as LocalRow]);
  const remote = new FakeRemote();
  let sent: Record<string, unknown> = {};
  remote.reject = (_t, r) => {
    sent = r;
    return null;
  };

  await pushTable(local, remote, 'accounts');

  assert.ok(!('_dirty' in sent));
  assert.ok(!('_lastError' in sent));
  assert.ok(!('updated_at' in sent), 'طابع الجهاز لا يُرسل — السيرفر يضبطه');
  assert.equal(sent.id, 'a');
});

test('الحذف ينتشر: deleted_at ضمن المدفوع', async () => {
  const local = new FakeLocal();
  local.seed('accounts', [
    { ...row('a', 1), deleted_at: '2026-11-03T10:00:00+00:00' } as LocalRow,
  ]);
  const remote = new FakeRemote();

  await pushTable(local, remote, 'accounts');

  assert.equal(
    remote.rows.get('accounts')!.get('a')!.deleted_at,
    '2026-11-03T10:00:00+00:00',
  );
});

test('صفّ مرفوض يُعزل ولا يُسقط الباقي', async () => {
  const many = Array.from({ length: 200 }, (_, i) => row(`r${i}`, 1));
  const local = new FakeLocal().seed('transactions', many);
  const remote = new FakeRemote();
  remote.reject = (_t, r) =>
    r.id === 'r137' ? 'violates foreign key constraint' : null;

  const { pushed, rejected } = await pushTable(local, remote, 'transactions');

  assert.equal(pushed, 199, 'الـ١٩٩ الباقية مرّت');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].id, 'r137');
  assert.match(rejected[0].error, /foreign key/);
  // الشقّ ثنائيّ: ٨ مستويات لا ٢٠٠ محاولة
  assert.ok(remote.log.length < 25, `محاولات: ${remote.log.length}`);
  assert.equal(local.get('transactions', 'r137')!._dirty, 1, 'المرفوض يبقى معدَّلًا');
  assert.equal(local.get('transactions', 'r0')!._dirty, 0);
});

test('لا شي معدَّل = لا طلب شبكة', async () => {
  const local = new FakeLocal().seed('accounts', [row('a', 0)]);
  const remote = new FakeRemote();
  const { pushed } = await pushTable(local, remote, 'accounts');
  assert.equal(pushed, 0);
  assert.deepEqual(remote.log, []);
});

// ─── السحب ──────────────────────────────────────────────────────────

test('المؤشّر يتقدّم إلى أكبر طابع سُحب', async () => {
  const local = new FakeLocal();
  const remote = new FakeRemote().seed('accounts', [
    { id: 'a', updated_at: '2026-11-03T12:00:00.000001+00:00' },
    { id: 'b', updated_at: '2026-11-03T12:00:00.000009+00:00' },
  ]);

  await pullTable(local, remote, 'accounts');

  assert.equal(
    await local.getCursor('accounts'),
    '2026-11-03T12:00:00.000009+00:00',
  );
});

test('صفر صفوف لا يحرّك المؤشّر ولا يكتب', async () => {
  const local = new FakeLocal();
  await local.setCursor('accounts', '2026-11-03T12:00:00.000005+00:00');
  const remote = new FakeRemote();

  const { pulled } = await pullTable(local, remote, 'accounts');

  assert.equal(pulled, 0);
  assert.equal(
    await local.getCursor('accounts'),
    '2026-11-03T12:00:00.000005+00:00',
  );
  assert.deepEqual(local.log, []);
});

test('الصفّ المعدَّل محليًّا ينجو من السحب — دفعه فشل', async () => {
  const local = new FakeLocal().seed('accounts', [
    { ...row('a', 1), name: 'ما كتبه المستخدم' } as LocalRow,
  ]);
  const remote = new FakeRemote().seed('accounts', [
    { id: 'a', updated_at: '2026-11-03T12:00:00.000100+00:00', name: 'نسخة السيرفر' },
  ]);

  const { pulled, keptLocal } = await pullTable(local, remote, 'accounts');

  assert.equal(keptLocal, 1);
  assert.equal(pulled, 0);
  assert.equal(local.get('accounts', 'a')!.name, 'ما كتبه المستخدم');
  assert.equal(local.get('accounts', 'a')!._dirty, 1, 'يُعاد دفعه لاحقًا');
});

test('الصفّ النظيف يُستبدل بنسخة السيرفر', async () => {
  const local = new FakeLocal().seed('accounts', [
    { ...row('a', 0), name: 'قديم' } as LocalRow,
  ]);
  const remote = new FakeRemote().seed('accounts', [
    { id: 'a', updated_at: '2026-11-03T12:00:00.000100+00:00', name: 'جديد' },
  ]);

  await pullTable(local, remote, 'accounts');

  assert.equal(local.get('accounts', 'a')!.name, 'جديد');
});

test('المؤشّر يتقدّم حتى لو تمسّكنا بالنسخة المحلية', async () => {
  // وإلّا بقي الصفّ يُسحب في كلّ مزامنة إلى الأبد
  const local = new FakeLocal().seed('accounts', [row('a', 1)]);
  const remote = new FakeRemote().seed('accounts', [
    { id: 'a', updated_at: '2026-11-03T12:00:00.000100+00:00' },
  ]);

  await pullTable(local, remote, 'accounts');

  assert.equal(
    await local.getCursor('accounts'),
    '2026-11-03T12:00:00.000100+00:00',
  );
});

test('السحب يُصفّح: أكثر من صفحة في جولة واحدة', async () => {
  const total = PULL_PAGE * 2 + 37;
  const remote = new FakeRemote().seed(
    'transactions',
    Array.from({ length: total }, (_, i) => ({
      id: `r${i}`,
      updated_at: `2026-11-03T12:00:00.${String(i + 1).padStart(6, '0')}+00:00`,
    })),
  );
  const local = new FakeLocal();

  const { pulled } = await pullTable(local, remote, 'transactions');

  // الشرط هو وصول كلّ صفّ، لا عددُ المنقول: السحب بـ`>=` يعيد صفّ
  // الحدّ في كلّ صفحة، فالمنقول أكبر بعدد الصفحات.
  assert.equal(local.rows.get('transactions')!.size, total, 'كلّ صفّ وصل');
  assert.ok(pulled >= total);
  assert.ok(pulled <= total + 3, `زائد الحدود محدود: ${pulled - total}`);
  assert.equal(
    await local.getCursor('transactions'),
    `2026-11-03T12:00:00.${String(total).padStart(6, '0')}+00:00`,
  );
});

test('حرس الحلقة: صفحة كاملة بطابع واحد تُوقف ولا تدور أبدًا', async () => {
  const same = '2026-11-03T12:00:00.000500+00:00';
  const remote = new FakeRemote().seed(
    'transactions',
    Array.from({ length: PULL_PAGE + 10 }, (_, i) => ({
      id: `r${i}`,
      updated_at: same,
    })),
  );
  const local = new FakeLocal();
  await local.setCursor('transactions', same);

  await assert.rejects(
    () => pullTable(local, remote, 'transactions'),
    /المؤشّر لا يتقدّم/,
  );
  // كُتبت محليًّا فعلًا، فالتقدّم يحصل لاحقًا لا يُفقد
  assert.equal(local.rows.get('transactions')!.size, PULL_PAGE);
});

// ─── الكلّ ──────────────────────────────────────────────────────────

test('الدفع كلّه قبل السحب كلّه', async () => {
  const local = new FakeLocal()
    .seed('accounts', [row('a', 1)])
    .seed('transactions', [row('t', 1)]);
  const remote = new FakeRemote();

  await syncAll(local, remote);

  const firstPull = remote.log.findIndex((l) => l.startsWith('pull:'));
  const lastPush = remote.log.reduce(
    (acc, l, i) => (l.startsWith('push:') ? i : acc),
    -1,
  );
  assert.ok(lastPush < firstPull, `الترتيب: ${remote.log.join(' ')}`);
});

test('الآباء قبل الأبناء في الطورين', async () => {
  const local = new FakeLocal()
    .seed('transactions', [row('t', 1)])
    .seed('accounts', [row('a', 1)])
    .seed('categories', [row('c', 1)]);
  const remote = new FakeRemote();

  await syncAll(local, remote);

  const order = (phase: string, table: string) =>
    remote.log.findIndex((l) => l.startsWith(`${phase}:${table}`));
  for (const phase of ['push', 'pull']) {
    assert.ok(order(phase, 'accounts') < order(phase, 'transactions'), `${phase}: حساب قبل عملية`);
    assert.ok(order(phase, 'categories') < order(phase, 'transactions'), `${phase}: فئة قبل عملية`);
  }
});

test('كل الجداول تُزار مرّة في كلّ طور', async () => {
  const local = new FakeLocal();
  const remote = new FakeRemote();
  await syncAll(local, remote);
  const pulls = remote.log.filter((l) => l.startsWith('pull:'));
  assert.equal(pulls.length, TABLE_ORDER.length);
  assert.equal(new Set(pulls).size, TABLE_ORDER.length);
});

test('فشل جدول لا يوقف البقيّة', async () => {
  const local = new FakeLocal()
    .seed('accounts', [row('a', 1)])
    .seed('alerts', [row('x', 1)]);
  const remote = new FakeRemote();
  remote.failTable = 'accounts';

  const res = await syncAll(local, remote);

  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.table === 'accounts'));
  assert.equal(local.get('alerts', 'x')!._dirty, 0, 'التنبيهات مرّت');
  assert.equal(local.get('accounts', 'a')!._dirty, 1, 'الحسابات تُعاد لاحقًا');
});

test('مزامنة نظيفة ok و المجاميع صحيحة', async () => {
  const local = new FakeLocal().seed('accounts', [row('a', 1), row('b', 1)]);
  const remote = new FakeRemote().seed('categories', [
    { id: 'c1', updated_at: '2026-11-03T12:00:00.000001+00:00' },
  ]);

  const res = await syncAll(local, remote);

  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
  assert.equal(res.pushed, 2);
  // صفوفنا تعود إلينا في السحب لأنّ مؤشّرنا كان null: ٢ حسابات + ١ فئة
  assert.equal(res.pulled, 3);
  assert.ok(local.get('categories', 'c1'), 'فئة السيرفر وصلت');
  for (const [, rows] of local.rows) {
    for (const [, r] of rows) assert.equal(r._dirty, 0, 'لا شي معدَّل بعد النجاح');
  }
});

test('مزامنة ثانية بلا تغيير = لا دفع ولا سحب', async () => {
  const local = new FakeLocal().seed('accounts', [row('a', 1)]);
  const remote = new FakeRemote();

  await syncAll(local, remote);
  const before = JSON.stringify([...local.rows.get('accounts')!]);
  remote.log = [];
  const second = await syncAll(local, remote);

  assert.equal(second.pushed, 0, 'لا شي معدَّل فلا دفع');
  assert.ok(!remote.log.some((l) => l.startsWith('push:')), 'ولا طلب دفع');
  // صفّ الحدّ وحده يعود، والحالة لا تتغيّر — هذا هو الاستقرار المطلوب
  assert.ok(second.pulled <= 1, `المعاد: ${second.pulled}`);
  assert.equal(
    JSON.stringify([...local.rows.get('accounts')!]),
    before,
    'مزامنة ثانية لا تغيّر شيئًا',
  );
});

test('الاستقرار: ثلاث مزامنات متتابعة تصل لحالة ثابتة', async () => {
  const local = new FakeLocal()
    .seed('accounts', [row('a', 1), row('b', 1)])
    .seed('transactions', [row('t', 1)]);
  const remote = new FakeRemote().seed('categories', [
    { id: 'c1', updated_at: '2026-11-03T12:00:00.000001+00:00' },
  ]);

  await syncAll(local, remote);
  const snap1 = JSON.stringify([...local.rows].map(([t, m]) => [t, [...m]]));
  await syncAll(local, remote);
  const snap2 = JSON.stringify([...local.rows].map(([t, m]) => [t, [...m]]));
  const third = await syncAll(local, remote);
  const snap3 = JSON.stringify([...local.rows].map(([t, m]) => [t, [...m]]));

  assert.equal(snap1, snap2, 'الثانية لم تغيّر');
  assert.equal(snap2, snap3, 'الثالثة لم تغيّر');
  assert.equal(third.pushed, 0);
  assert.equal(third.ok, true);
});
