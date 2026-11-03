/**
 * `RemoteStore` على Supabase.
 *
 * الواجهة أدناه هي الحدّ الأدنى الذي نستعمله من `supabase-js`، معلَنًا
 * محليًّا حتى يبقى الملفّ قابلًا للفحص والاختبار دون تثبيت الحزمة.
 */

import type { SyncRow, SyncTable } from './plan';
import type { RemoteStore } from './store';

interface Result<T> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
}

interface SelectBuilder {
  gte(column: string, value: string): SelectBuilder;
  order(column: string, opts: { ascending: boolean }): SelectBuilder;
  limit(n: number): PromiseLike<Result<SyncRow[]>>;
}

interface TableBuilder {
  select(columns: string): SelectBuilder & PromiseLike<Result<SyncRow[]>>;
  upsert(
    rows: Record<string, unknown>[],
    opts: { onConflict: string },
  ): { select(columns: string): PromiseLike<Result<SyncRow[]>> };
}

export interface MinimalSupabase {
  from(table: string): TableBuilder;
}

export class SupabaseStore implements RemoteStore {
  constructor(private client: MinimalSupabase) {}

  /**
   * `upsert` على `id` ثم `select()` لاستعادة ما استقرّ عليه السيرفر.
   *
   * الـ`select()` ليست تحسينًا: التريقر على السيرفر هو من يضبط
   * `updated_at`، فبدون قراءته يبقى الصفّ محليًّا بطابع ساعة الجهاز
   * ويُسحب في كلّ مزامنة إلى ما لا نهاية.
   */
  async push(table: SyncTable, rows: Record<string, unknown>[]): Promise<SyncRow[]> {
    const { data, error } = await this.client
      .from(table)
      .upsert(rows, { onConflict: 'id' })
      .select('*');

    if (error) {
      // نص الخطأ يُعرض للمستخدم وقد يُخزَّن، فنُبقيه موجزًا ومفيدًا
      throw new Error(
        [error.code, error.message, error.details].filter(Boolean).join(' · '),
      );
    }
    return data ?? [];
  }

  /**
   * `gte` لا `gt`، ومرتّبًا تصاعديًّا بـ`updated_at`.
   *
   * الترتيب شرط لصحّة الترقيم: المؤشّر هو أكبر طابع في الصفحة، فلو
   * جاءت الصفوف غير مرتّبة تخطّى المؤشّر صفوفًا لم تُسحب بعد.
   *
   * ولا نضيف `eq('user_id', …)`: RLS تتولّاه على السيرفر، ومُختبَر
   * هناك (٧/٧). تكرار الشرط في العميل يوهم أنّه هو الحارس.
   */
  async pull(table: SyncTable, since: string | null, limit: number): Promise<SyncRow[]> {
    // النوع SelectBuilder لا الاجتماع: gte تُرجع البانيَ وحده
    let q: SelectBuilder = this.client.from(table).select('*');
    if (since !== null) q = q.gte('updated_at', since);
    const { data, error } = await q.order('updated_at', { ascending: true }).limit(limit);

    if (error) {
      throw new Error(
        [error.code, error.message, error.details].filter(Boolean).join(' · '),
      );
    }
    return data ?? [];
  }
}
