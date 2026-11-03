/**
 * الواجهتان اللتان تقف المزامنة عليهما.
 *
 * `sync.ts` لا يستورد `expo-sqlite` ولا `supabase-js`، بل هاتين
 * الواجهتين. والسبب ليس تجميلًا معماريًّا:
 *
 * أخطاء المزامنة هي أخطاء **ترتيب وحالة** — دفعٌ بعد سحب، علمُ
 * `_dirty` لم يُمسح، مؤشّر لم يتقدّم، صفّ سامّ يوقف الطابور. وهذه
 * كلّها تُختبر بمخزنين وهميّين في الذاكرة في مللي ثانية، ولا تُختبر
 * على جهاز إلّا بالحظّ. فالفصل هنا هو ما يجعلها مُختبَرة أصلًا.
 */

import type { LocalRow, SyncRow, SyncTable } from './plan';

export interface LocalStore {
  /** آخر `updated_at` سُحب لهذا الجدول. null = لم تُزامَن قطّ. */
  getCursor(table: SyncTable): Promise<string | null>;
  setCursor(table: SyncTable, cursor: string): Promise<void>;

  /** الصفوف المعدّلة محليًّا ولم تُدفع. */
  dirtyRows(table: SyncTable): Promise<LocalRow[]>;

  /**
   * بعد دفع ناجح: يكتب `updated_at` **القادم من السيرفر** ويمسح
   * `_dirty`. كتابة قيمة السيرفر ضرورية لا تحسينيّة: بدونها يبقى
   * الصفّ بطابع ساعة الجهاز، فيُسحب من جديد في كلّ مزامنة.
   */
  markClean(table: SyncTable, serverRows: SyncRow[]): Promise<void>;

  getByIds(table: SyncTable, ids: string[]): Promise<Map<string, LocalRow>>;

  /** كتابة صفوف السيرفر محليًّا (upsert، فإعادة السحب بلا ضرر). */
  upsertFromRemote(table: SyncTable, rows: SyncRow[]): Promise<void>;
}

export interface RemoteStore {
  /**
   * يدفع صفوفًا ويُرجع ما استقرّ عليه السيرفر (ومعه `updated_at`).
   * يرمي عند الفشل — الفشل جزء من العقد، و`sync.ts` يعزله.
   */
  push(table: SyncTable, rows: Record<string, unknown>[]): Promise<SyncRow[]>;

  /**
   * يسحب ما `updated_at >= since`، مرتّبًا تصاعديًّا، بحدّ `limit`.
   *
   * `>=` لا `>` عن قصد: الطوابع بدقّة ميكروثانية وقد يتساوى صفّان في
   * اللحظة نفسها، فـ`>` يفوّت أحدهما إلى الأبد. وإعادة سحب صفّ الحدّ
   * بلا ضرر لأنّ الكتابة المحلية upsert.
   */
  pull(table: SyncTable, since: string | null, limit: number): Promise<SyncRow[]>;
}

export type { LocalRow, SyncRow, SyncTable };
