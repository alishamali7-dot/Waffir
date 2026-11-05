/**
 * من بذرة الإعداد إلى صفوف القاعدة.
 *
 * `templates.ts` يعمل بمعرّفات نصّية («card»، «food») لأنّه يبني حالةً في
 * الذاكرة، والقاعدة تطلب uuid. فهذا الملفّ هو الجسر الوحيد بينهما، ويُرسَل
 * ناتجه كاملًا إلى `seed_account` فيُكتب في معاملةٍ واحدة أو لا يُكتب.
 *
 * وما تأباه القاعدة يُحذف هنا لا عند الخطأ: هدف ادّخارٍ بمبلغ صفر (من تخطّى
 * خطوة الدخل) يكسر `savings_goals_amount_ck` ويُسقط الإعداد كلّه.
 */

import type { Strings } from './i18n';
import { normalizeDigits } from './supabase/functions/_shared/parse-amount';
import type { AppState } from './types';

/** ما فوقه خطأ كتابة لا دخل. */
const MAX_INCOME = 1_000_000_000;

/**
 * المبلغ كما كتبه المستخدم، بوحداتٍ كبرى. الفراغ صفر (تخطٍّ)، وما لا يُفهم
 * null.
 *
 * ليس `parseAmountToMinor`: ذاك للفواتير حيث «1,250» بالدينار تعني ١٫٢٥٠.
 * أمّا هنا فالخانة خانة راتب، والفاصلة فيها فاصلة آلاف.
 */
export function parseIncomeInput(raw: string): number | null {
  const text = normalizeDigits(raw)
    .replace(/[,٬،\s]/g, '')
    .replace('٫', '.');
  if (!text) return 0;
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const value = Number(text);
  return value <= MAX_INCOME ? value : null;
}

/**
 * هل الحساب بلا إعداد؟
 *
 * بلا حساب مصرفيّ ولا فئة. والشرطان معًا: مَن حذف حساباته لا يُعاد إلى
 * الإعداد ما دامت له فئات. و`seed_account` يفحص الشرط نفسه في القاعدة.
 */
export function isEmptyAccount(state: Pick<AppState, 'accounts' | 'categories'>): boolean {
  return state.accounts.length === 0 && state.categories.length === 0;
}

export function buildSeed(
  state: AppState,
  names: Strings['seed'],
  locale: 'ar' | 'en',
  uuid: () => string = () => crypto.randomUUID(),
) {
  const label = (id: string, fallback: string) => names[id as keyof Strings['seed']] ?? fallback;

  // معرّف البذرة ← uuid. الدخل والأهداف تُشير إلى الحساب بمعرّفه.
  const accountIds = new Map(state.accounts.map((a) => [a.id, uuid()]));
  const accountRef = (id: string | undefined) => (id ? accountIds.get(id) ?? null : null);

  const primary = state.income.sources.find((s) => s.isPrimary);

  return {
    profile: {
      currency_code: state.income.currency.code,
      currency_symbol: state.income.currency.symbol,
      minor_units: state.income.currency.minorUnits,
      income_shape: state.income.shape,
      pay_day_of_month: primary?.payDayOfMonth ?? null,
      alert_salary_day_rollover: state.alertRules.salaryDayRollover,
      locale,
    },
    accounts: state.accounts.map((a, i) => ({
      id: accountIds.get(a.id)!,
      name: label(a.id, a.name),
      kind: a.kind,
      color: a.color,
      exclude_from_spending: a.excludeFromSpending,
      sort_order: i,
    })),
    categories: state.categories.map((c) => ({
      id: uuid(),
      name: label(c.id, c.name),
      color: c.color,
      icon: c.icon,
      monthly_limit: c.monthlyLimit,
      keywords: c.keywords,
      sort_order: c.order,
    })),
    income_sources: state.income.sources.map((s) => ({
      id: uuid(),
      name: label(state.income.shape === 'allowance' ? 'allowance' : s.id, s.name),
      typical_amount: s.typicalAmount ?? null,
      pay_day_of_month: s.payDayOfMonth ?? null,
      account_id: accountRef(s.accountId),
      is_primary: s.isPrimary,
    })),
    commitments: state.commitments.map((c) => ({
      id: uuid(),
      name: label(c.id, c.name),
      kind: c.kind,
      amount: c.amount,
      is_approximate: c.isApproximate,
      auto_deduct: c.autoDeduct,
    })),
    goals: state.goals
      .filter((g) => g.amountPerPeriod > 0)
      .map((g) => ({
        id: uuid(),
        name: label(g.id, g.name),
        color: g.color,
        cadence: g.cadence,
        amount_per_period: g.amountPerPeriod,
        account_id: accountRef(g.accountId),
        target_amount: g.targetAmount && g.targetAmount > 0 ? g.targetAmount : null,
      })),
  };
}

/**
 * كيف تنقسم البذرة على الدخل: ما يُعرض في الخطوة الأخيرة قبل الحفظ.
 * بوحداتٍ صغرى، والفائض لا ينزل تحت الصفر.
 */
export function splitOf(state: AppState) {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const total = sum(state.income.sources.map((s) => s.typicalAmount ?? 0));
  const fixed = sum(state.commitments.map((c) => c.amount));
  const limits = sum(state.categories.map((c) => c.monthlyLimit ?? 0));
  const savings = sum(state.goals.map((g) => g.amountPerPeriod));
  return { total, fixed, limits, savings, free: Math.max(0, total - fixed - limits - savings) };
}
