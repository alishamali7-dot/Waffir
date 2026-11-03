/**
 * `LocalStore` على SQLite، ومعه واجهة الكتابة التي تستعملها الشاشات.
 *
 * يحتاج: npx expo install expo-sqlite
 */

import type { LocalRow, SyncRow, SyncTable } from '../sync/plan';
import type { LocalStore } from '../sync/store';
import { LOCAL_SCHEMA, SCHEMA_VERSION } from './local-schema';

/** الحدّ الأدنى من واجهة expo-sqlite، حتى يبقى الملفّ مُختبَرًا. */
export interface SqliteDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

interface StoredRow {
  id: string;
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
  _dirty: number;
  data: string;
}

/** الأعمدة الحقيقية في كلّ جدول؛ البقيّة تذهب إلى `data`. */
const REAL: Record<string, string[]> = {
  transactions: ['occurred_at', 'account_id', 'category_id', 'kind', 'amount'],
  savings_deposits: ['goal_id', 'deposit_date'],
  income_overrides: ['month'],
  categories: ['sort_order', 'archived'],
  accounts: ['sort_order', 'archived'],
  savings_goals: ['active'],
  fixed_commitments: ['active'],
  installments: ['active'],
  sinking_funds: ['active', 'due_month'],
  income_sources: ['active', 'is_primary'],
  alerts: ['raised_at', 'dismissed_at'],
};

const BASE = ['id', 'user_id', 'updated_at', 'deleted_at'];

/** SQLite ليس فيه boolean: true → 1. */
const sqlValue = (v: unknown) =>
  typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v;

function split(table: string, row: Record<string, unknown>) {
  const real = REAL[table] ?? [];
  const promoted = new Set([...BASE, ...real]);
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // الأعمدة المحلّية لا تُخزَّن داخل data، وإلّا رجعت في الدفع
    if (k.startsWith('_')) continue;
    if (!promoted.has(k)) rest[k] = v;
  }
  return { real, rest };
}

function hydrate(table: string, s: StoredRow & Record<string, unknown>): LocalRow {
  const real = REAL[table] ?? [];
  const out: Record<string, unknown> = JSON.parse(s.data);
  out.id = s.id;
  out.user_id = s.user_id;
  out.updated_at = s.updated_at;
  out.deleted_at = s.deleted_at;
  for (const c of real) out[c] = s[c];
  out._dirty = s._dirty === 1 ? 1 : 0;
  return out as LocalRow;
}

export async function openLocalDb(db: SqliteDb): Promise<void> {
  for (const stmt of LOCAL_SCHEMA) await db.execAsync(stmt);
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['schema_version', String(SCHEMA_VERSION)],
  );
}

export class SqliteStore implements LocalStore {
  constructor(
    private db: SqliteDb,
    /** كلّ استعلام مقيَّد بالمستخدم: تبديل الحساب لا يخلط البيانات. */
    private userId: string,
  ) {}

  private async write(
    table: SyncTable | 'profiles',
    row: Record<string, unknown>,
    dirty: 0 | 1,
    updatedAt?: string,
  ): Promise<void> {
    const { real, rest } = split(table, row);
    const cols = [...BASE, ...real, '_dirty', 'data'];
    const vals = [
      row.id,
      this.userId,
      updatedAt ?? row.updated_at ?? '',
      row.deleted_at ?? null,
      ...real.map((c) => sqlValue(row[c])),
      dirty,
      JSON.stringify(rest),
    ].map(sqlValue);

    // ON CONFLICT ... DO UPDATE: الكتابة upsert، فإعادة سحب صفّ الحدّ
    // بلا ضرر، وهذا ما يسمح بالسحب بـ`>=` بدل `>`.
    const setters = cols
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');

    await this.db.runAsync(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET ${setters}`,
      vals,
    );
  }

  // ─── LocalStore ────────────────────────────────────────────────────

  async getCursor(table: SyncTable): Promise<string | null> {
    const rows = await this.db.getAllAsync<{ cursor: string }>(
      'SELECT cursor FROM sync_cursors WHERE table_name = ?',
      [table],
    );
    return rows[0]?.cursor ?? null;
  }

  async setCursor(table: SyncTable, cursor: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_cursors (table_name, cursor, synced_at) VALUES (?, ?, ?)
       ON CONFLICT(table_name) DO UPDATE SET cursor = excluded.cursor, synced_at = excluded.synced_at`,
      [table, cursor, new Date().toISOString()],
    );
  }

  async dirtyRows(table: SyncTable): Promise<LocalRow[]> {
    const rows = await this.db.getAllAsync<StoredRow & Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE user_id = ? AND _dirty = 1 ORDER BY rowid`,
      [this.userId],
    );
    return rows.map((r) => hydrate(table, r));
  }

  async markClean(table: SyncTable, serverRows: SyncRow[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const s of serverRows) {
        // طابع السيرفر لا طابع الجهاز: بدونه يُسحب الصفّ كلّ مرّة
        await this.db.runAsync(
          `UPDATE ${table} SET updated_at = ?, _dirty = 0 WHERE id = ? AND user_id = ?`,
          [s.updated_at, s.id, this.userId],
        );
      }
    });
  }

  async getByIds(table: SyncTable, ids: string[]): Promise<Map<string, LocalRow>> {
    const out = new Map<string, LocalRow>();
    if (ids.length === 0) return out;
    // SQLite يحدّ المتغيّرات بـ999؛ نقسّم على 400 بأمان
    for (let i = 0; i < ids.length; i += 400) {
      const part = ids.slice(i, i + 400);
      const rows = await this.db.getAllAsync<StoredRow & Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE user_id = ? AND id IN (${part.map(() => '?').join(',')})`,
        [this.userId, ...part],
      );
      for (const r of rows) out.set(r.id, hydrate(table, r));
    }
    return out;
  }

  async upsertFromRemote(table: SyncTable, rows: SyncRow[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) {
        await this.write(table, r as Record<string, unknown>, 0, r.updated_at);
      }
    });
  }

  // ─── ما تستعمله الشاشات ────────────────────────────────────────────

  /**
   * حفظ من الواجهة: يكتب محليًّا ويعلّم `_dirty = 1`.
   *
   * يُستدعى بلا إنترنت ويعمل. المعرّف يولّده الجهاز (`Crypto.randomUUID`)
   * ويُرسَل كما هو، فالصفّ له هويّة قبل أن يراه أيّ سيرفر.
   */
  async save(table: SyncTable, row: Record<string, unknown>): Promise<void> {
    await this.write(table, row, 1);
  }

  async saveMany(table: SyncTable, rows: Record<string, unknown>[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const r of rows) await this.write(table, r, 1);
    });
  }

  /**
   * حذف ناعم. **لا `DELETE`.**
   *
   * بلا شاهدة قبر لا يصل الحذف للأجهزة الأخرى: المزامنة القادمة ترى
   * صفًّا ناقصًا عندنا وموجودًا على السيرفر فتُرجعه.
   */
  async softDelete(table: SyncTable, id: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE ${table} SET deleted_at = ?, _dirty = 1 WHERE id = ? AND user_id = ?`,
      [new Date().toISOString(), id, this.userId],
    );
  }

  async list(
    table: SyncTable,
    opts: { where?: string; params?: unknown[]; orderBy?: string; limit?: number } = {},
  ): Promise<LocalRow[]> {
    const where = opts.where ? ` AND ${opts.where}` : '';
    const order = opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '';
    const limit = opts.limit ? ` LIMIT ${opts.limit}` : '';
    const rows = await this.db.getAllAsync<StoredRow & Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE user_id = ? AND deleted_at IS NULL${where}${order}${limit}`,
      [this.userId, ...(opts.params ?? [])],
    );
    return rows.map((r) => hydrate(table, r));
  }

  /** عمليات شهر واحد: "2026-11". */
  async transactionsOfMonth(month: string): Promise<LocalRow[]> {
    return this.list('transactions', {
      where: "occurred_at >= ? AND occurred_at < ?",
      params: [`${month}-01`, nextMonth(month)],
      orderBy: 'occurred_at DESC',
    });
  }

  async pendingCount(): Promise<number> {
    const rows = await this.db.getAllAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions WHERE user_id = ? AND _dirty = 1`,
      [this.userId],
    );
    return rows[0]?.n ?? 0;
  }

  async recordRejects(
    table: SyncTable,
    rejects: Array<{ id: string; error: string }>,
  ): Promise<void> {
    const at = new Date().toISOString();
    for (const r of rejects) {
      await this.db.runAsync(
        `INSERT INTO sync_rejects (id, table_name, error, at) VALUES (?, ?, ?, ?)
         ON CONFLICT(table_name, id) DO UPDATE SET error = excluded.error, at = excluded.at`,
        [r.id, table, r.error, at],
      );
    }
  }
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
