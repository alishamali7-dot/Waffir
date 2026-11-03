/**
 * تنفيذ المزامنة. القرارات في plan.ts، والتخزين خلف store.ts، وهذا
 * الملفّ ينظّم الترتيب ويعزل الفشل.
 */

import {
  PUSH_CHUNK,
  TABLE_ORDER,
  chunk,
  compareTimestamps,
  forPush,
  nextCursor,
  resolve,
  type SyncRow,
  type SyncTable,
} from './plan';
import type { LocalStore, RemoteStore } from './store';

export const PULL_PAGE = 500;

export interface TableReport {
  table: SyncTable;
  pushed: number;
  pulled: number;
  keptLocal: number;
  /** صفوف رفضها السيرفر ولا يفيد إعادة دفعها كما هي */
  rejected: Array<{ id: string; error: string }>;
}

export interface SyncResult {
  ok: boolean;
  tables: TableReport[];
  errors: Array<{ table: SyncTable; phase: 'push' | 'pull'; error: string }>;
  get pushed(): number;
  get pulled(): number;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── الدفع ───────────────────────────────────────────────────────────

/**
 * يدفع دفعةً، وإن فشلت يشقّها نصفين ويعيد.
 *
 * السبب: upsert لمئتَي صفّ يفشل كلّه إذا رفض السيرفر صفًّا واحدًا —
 * مفتاح أجنبيّ لحساب لم يُدفع بعد، أو قيد تحويل مخالف. بلا عزل يبقى
 * الصفّ السامّ في الطابور ويوقف المزامنة **إلى الأبد**، وهذا أسوأ
 * أعطال المزامنة: المستخدم يسجّل ولا يتزامن شيء ولا يعرف السبب.
 *
 * الشقّ ثنائيّ فعمقه لوغاريتميّ: ٢٠٠ صفّ فيها صفّ سيّئ = ٨ محاولات
 * إضافية على الأكثر، لا ٢٠٠.
 */
async function pushBatch(
  remote: RemoteStore,
  table: SyncTable,
  rows: Record<string, unknown>[],
  accepted: SyncRow[],
  rejected: Array<{ id: string; error: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const back = await remote.push(table, rows);
    accepted.push(...back);
    return;
  } catch (e) {
    if (rows.length === 1) {
      rejected.push({ id: String(rows[0].id ?? '?'), error: message(e) });
      return;
    }
    const mid = Math.floor(rows.length / 2);
    await pushBatch(remote, table, rows.slice(0, mid), accepted, rejected);
    await pushBatch(remote, table, rows.slice(mid), accepted, rejected);
  }
}

export async function pushTable(
  local: LocalStore,
  remote: RemoteStore,
  table: SyncTable,
): Promise<{ pushed: number; rejected: Array<{ id: string; error: string }> }> {
  const dirty = await local.dirtyRows(table);
  if (dirty.length === 0) return { pushed: 0, rejected: [] };

  const accepted: SyncRow[] = [];
  const rejected: Array<{ id: string; error: string }> = [];

  for (const part of chunk(dirty.map(forPush), PUSH_CHUNK)) {
    await pushBatch(remote, table, part, accepted, rejected);
  }

  if (accepted.length > 0) await local.markClean(table, accepted);
  return { pushed: accepted.length, rejected };
}

// ─── السحب ───────────────────────────────────────────────────────────

/**
 * السحب يُعيد صفوفًا نعرفها، وهذا صحيح لا عيب. موضعان:
 *
 * ١. **صفّ الحدّ.** السحب بـ`>=` فآخر صفّ في كلّ صفحة يعود في أوّل
 *    الصفحة التالية. البديل `>` يفوّت صفًّا كُتب في الميكروثانية
 *    نفسها، وفقدان صفّ أسوأ من نقله مرّتين.
 *
 * ٢. **صفوفنا نحن.** بعد الدفع تصير لصفوفنا طوابع سيرفر أحدث من
 *    مؤشّرنا، فيعيدها السحب. يمكن تجنّبه بتقديم المؤشّر إلى أحدث ما
 *    دفعناه — وهذا **خطأ**: يتخطّى ما كتبه جهاز آخر بين مؤشّرنا
 *    ودفعنا، فيُفقد إلى الأبد. فنقبل النقل الزائد.
 *
 * الحالتان بلا ضرر لأنّ الكتابة المحلية upsert والصفّ النظيف يُستبدل
 * بمثله. ولذلك تقيس الاختبارات **الاستقرار** لا عدد الصفوف المنقولة.
 */
export async function pullTable(
  local: LocalStore,
  remote: RemoteStore,
  table: SyncTable,
): Promise<{ pulled: number; keptLocal: number }> {
  let cursor = await local.getCursor(table);
  let pulled = 0;
  let keptLocal = 0;

  for (;;) {
    const page = await remote.pull(table, cursor, PULL_PAGE);
    if (page.length === 0) break;

    const localRows = await local.getByIds(
      table,
      page.map((r) => r.id),
    );

    const take: SyncRow[] = [];
    for (const row of page) {
      if (resolve(localRows.get(row.id), row) === 'take_remote') take.push(row);
      else keptLocal++;
    }

    if (take.length > 0) await local.upsertFromRemote(table, take);
    pulled += take.length;

    const advanced = nextCursor(page, cursor);

    /**
     * حرس ضدّ حلقة لا نهائية.
     *
     * السحب بـ`>=`، فإذا امتلأت الصفحة كلّها بصفوف لها **الطابع
     * نفسه**، لم يتقدّم المؤشّر وستُعيد الصفحة التالية الصفوف ذاتها
     * إلى الأبد. يحدث حين يكتب السيرفر دفعةً كبيرة في معاملة واحدة
     * (استيراد أوّليّ مثلًا) فتتساوى طوابعها.
     *
     * نتوقّف ونُبلغ. التقدّم يحصل في المزامنة القادمة لأنّ الصفوف
     * كُتبت محليًّا فعلًا.
     */
    const stuck =
      advanced !== null &&
      cursor !== null &&
      compareTimestamps(advanced, cursor) === 0;

    if (advanced !== null) {
      cursor = advanced;
      await local.setCursor(table, advanced);
    }

    if (stuck && page.length >= PULL_PAGE) {
      throw new Error(
        `${table}: صفحة كاملة بطابع واحد (${cursor}) — المؤشّر لا يتقدّم`,
      );
    }

    if (page.length < PULL_PAGE) break;
  }

  return { pulled, keptLocal };
}

// ─── الكلّ ───────────────────────────────────────────────────────────

/**
 * **الدفع كلّه قبل السحب كلّه.**
 *
 * الترتيب هو ما يجعل حلّ التعارض سطرًا واحدًا في `plan.ts`: بوقت
 * السحب، كلّ تعديل محلّي ناجح صار مدفوعًا ونظيفًا، فالصفّ الذي بقي
 * `_dirty` معناه أن دفعه فشل، فنتمسّك به. لو سحبنا أوّلًا لاحتجنا
 * مقارنة ساعة الجهاز بساعة السيرفر، وهي مقارنة لا تصحّ.
 *
 * والجداول بترتيب الآباء قبل الأبناء في الطورين: الدفع يحتاجه لأنّ
 * المفتاح الأجنبيّ يرفض عمليةً قبل حسابها، والسحب يحتاجه للسبب نفسه
 * في القاعدة المحلية.
 *
 * فشل جدول لا يوقف البقية: يُسجَّل ويُعاد في المزامنة القادمة.
 */
export async function syncAll(
  local: LocalStore,
  remote: RemoteStore,
): Promise<SyncResult> {
  const tables = new Map<SyncTable, TableReport>();
  const errors: SyncResult['errors'] = [];

  const report = (t: SyncTable): TableReport => {
    let r = tables.get(t);
    if (!r) {
      r = { table: t, pushed: 0, pulled: 0, keptLocal: 0, rejected: [] };
      tables.set(t, r);
    }
    return r;
  };

  for (const table of TABLE_ORDER) {
    try {
      const { pushed, rejected } = await pushTable(local, remote, table);
      const r = report(table);
      r.pushed = pushed;
      r.rejected = rejected;
    } catch (e) {
      errors.push({ table, phase: 'push', error: message(e) });
    }
  }

  for (const table of TABLE_ORDER) {
    try {
      const { pulled, keptLocal } = await pullTable(local, remote, table);
      const r = report(table);
      r.pulled = pulled;
      r.keptLocal = keptLocal;
    } catch (e) {
      errors.push({ table, phase: 'pull', error: message(e) });
    }
  }

  const list = [...tables.values()];
  return {
    ok: errors.length === 0 && list.every((t) => t.rejected.length === 0),
    tables: list,
    errors,
    get pushed() {
      return list.reduce((a, t) => a + t.pushed, 0);
    },
    get pulled() {
      return list.reduce((a, t) => a + t.pulled, 0);
    },
  };
}
