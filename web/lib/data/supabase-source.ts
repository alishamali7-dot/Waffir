/**
 * مصدر Supabase — جاهز، ويعمل متى وُجدت جلسة.
 *
 * بلا جلسة تُرجع RLS صفر صفوف لكلّ استعلام، ولا ترمي خطأً. فالمصدر
 * يكشف ذلك صريحًا بـ`hasSession()` بدل أن يُظهر تطبيقًا فارغًا ويترك
 * المستخدم يحدس.
 *
 * المصادقة (تسجيل دخول، حساب جديد، Apple، Google، حذف حساب) تُضاف
 * لاحقًا، ولا تمسّ هذا الملفّ: كلّ ما تفعله أن تُوجد الجلسة.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type Account,
  type AppState,
  type Category,
  type CurrencyConfig,
  type FixedCommitment,
  type IncomeShape,
  type IncomeSource,
  type SavingsGoal,
  type Transaction,
} from '@shared/types';

import type { DataSource } from './source';

/** الحالة الفارغة: ما تُعرض به الواجهة قبل وجود جلسة. */
const EMPTY_CURRENCY: CurrencyConfig = { code: 'KWD', symbol: 'د.ك', minorUnits: 3 };

export class SupabaseSource implements DataSource {
  readonly kind = 'supabase' as const;
  readonly isLive = true;

  constructor(private client: SupabaseClient) {}

  async hasSession(): Promise<boolean> {
    const { data } = await this.client.auth.getUser();
    return data.user !== null;
  }

  async loadState(): Promise<AppState> {
    // استعلامات متوازية: الواجهة تنتظر أبطأها لا مجموعها
    const [profile, accounts, categories, sources, commitments, goals, txs] =
      await Promise.all([
        this.one('profiles'),
        this.many('accounts'),
        this.many('categories'),
        this.many('income_sources'),
        this.many('fixed_commitments'),
        this.many('savings_goals'),
        this.manyTransactions(),
      ]);

    const currency: CurrencyConfig = profile
      ? {
          code: String(profile.currency_code),
          symbol: String(profile.currency_symbol),
          minorUnits: Number(profile.minor_units),
        }
      : EMPTY_CURRENCY;

    return {
      income: {
        shape: (profile?.income_shape as IncomeShape) ?? 'none',
        sources: sources.map(toIncomeSource),
        currency,
      },
      incomeOverrides: {},
      accounts: accounts.map(toAccount),
      categories: categories.map(toCategory),
      commitments: commitments.map(toCommitment),
      installments: [],
      sinkingFunds: [],
      goals: goals.map(toGoal),
      deposits: [],
      transactions: txs.map(toTransaction),
      // المرفقات تُحمَّل عند فتح العملية لا مع اللوحة: صفّها صغير
      // لكن عددها ينمو بعدد الفواتير، ولا تُعرض في لوحة البيانات.
      attachments: [],
      alertRules: {
        categoryWarnAt: Number(profile?.category_warn_at ?? 0.85),
        duplicateSubscriptions: Boolean(profile?.alert_duplicate_subscriptions ?? true),
        dailySavingsReminderAt: (profile?.daily_savings_reminder_at as string) ?? null,
        salaryDayRollover: Boolean(profile?.alert_salary_day_rollover ?? false),
      },
      alerts: [],
      schemaVersion: 1,
    };
  }

  // ─── قراءة ─────────────────────────────────────────────────────────

  private async many(table: string): Promise<Row[]> {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .is('deleted_at', null);
    if (error) throw new Error(`${table}: ${error.message}`);
    return (data ?? []) as Row[];
  }

  private async one(table: string): Promise<Row | null> {
    const { data, error } = await this.client.from(table).select('*').limit(1);
    if (error) throw new Error(`${table}: ${error.message}`);
    return ((data ?? [])[0] as Row) ?? null;
  }

  /**
   * عمليات آخر ١٣ شهرًا وحدها.
   *
   * لوحة البيانات تحتاج الشهر الحاليّ، والتقارير تحتاج ستّة، وعمود
   * «الشهر نفسه قبل سنة» يحتاج الثالث عشر. وسحب كلّ تاريخ المستخدم
   * يثقل أوّل تحميل بلا فائدة تُعرض.
   */
  private async manyTransactions(): Promise<Row[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - 13);
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .is('deleted_at', null)
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: false })
      // عمليات اليوم الواحد تحمل الوقت نفسه (انظر `occurredAtOf`).
      .order('created_at', { ascending: false });
    if (error) throw new Error(`transactions: ${error.message}`);
    return (data ?? []) as Row[];
  }
}

type Row = Record<string, unknown>;

const s = (v: unknown): string => String(v ?? '');
const n = (v: unknown): number => Number(v ?? 0);

function toAccount(r: Row): Account {
  return {
    id: s(r.id),
    name: s(r.name),
    kind: (r.kind as Account['kind']) ?? 'other',
    color: s(r.color),
    openingBalance: n(r.opening_balance),
    excludeFromSpending: Boolean(r.exclude_from_spending),
    currencyCode: (r.currency_code as string) ?? undefined,
    archived: Boolean(r.archived),
  };
}

function toCategory(r: Row): Category {
  return {
    id: s(r.id),
    name: s(r.name),
    color: s(r.color),
    icon: s(r.icon),
    // null في القاعدة = «خذ المتبقّي»، وهو نفس معناه في النموذج
    monthlyLimit: r.monthly_limit === null ? null : n(r.monthly_limit),
    keywords: (r.keywords as string[]) ?? [],
    order: n(r.sort_order),
    archived: Boolean(r.archived),
  };
}

function toIncomeSource(r: Row): IncomeSource {
  return {
    id: s(r.id),
    name: s(r.name),
    typicalAmount: r.typical_amount === null ? undefined : n(r.typical_amount),
    payDayOfMonth: r.pay_day_of_month === null ? undefined : n(r.pay_day_of_month),
    accountId: s(r.account_id),
    isPrimary: Boolean(r.is_primary),
    active: Boolean(r.active),
  };
}

function toCommitment(r: Row): FixedCommitment {
  return {
    id: s(r.id),
    name: s(r.name),
    kind: (r.kind as FixedCommitment['kind']) ?? 'other',
    amount: n(r.amount),
    isApproximate: Boolean(r.is_approximate),
    autoDeduct: Boolean(r.auto_deduct),
    active: Boolean(r.active),
    startedOn: (r.started_on as string) ?? undefined,
  };
}

function toGoal(r: Row): SavingsGoal {
  return {
    id: s(r.id),
    name: s(r.name),
    color: s(r.color),
    cadence: (r.cadence as SavingsGoal['cadence']) ?? 'monthly',
    amountPerPeriod: n(r.amount_per_period),
    accountId: (r.account_id as string) ?? undefined,
    targetAmount: r.target_amount === null ? undefined : n(r.target_amount),
    targetDate: (r.target_date as string) ?? undefined,
    active: Boolean(r.active),
  };
}

function toTransaction(r: Row): Transaction {
  const kind = s(r.kind);
  return {
    id: s(r.id),
    occurredAt: s(r.occurred_at),
    amount: n(r.amount),
    // النموذج يحمل direction، والقاعدة تحمل kind. التحويل هو
    // الموضع الوحيد الذي يعرف الفرق.
    direction: kind === 'income' ? 'credit' : 'debit',
    description: s(r.description),
    categoryId: (r.category_id as string) ?? null,
    accountId: s(r.account_id),
    transferToAccountId: (r.to_account_id as string) ?? undefined,
    source: (r.source as Transaction['source']) ?? 'manual',
    rawText: (r.raw_text as string) ?? undefined,
    needsReview: Boolean(r.needs_review),
    dedupeKey: s(r.dedupe_key),
  };
}
