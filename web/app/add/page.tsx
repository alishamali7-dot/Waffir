import { redirect } from 'next/navigation';

import { AddExpense } from '@/components/AddExpense';
import { loadAppState } from '@/lib/data';
import { getLocale } from '@/lib/lang';
import { computeBudget, monthKeyOf } from '@shared/budget';

import '../login/auth.css';
import './add.css';

/**
 * إضافة مصروف.
 *
 * الزائر يرى بيانات عيّنة في بقيّة الشاشات، أمّا هنا فلا شيء يُحفظ له،
 * فيُرسل إلى الدخول بدل نموذجٍ يفشل عند الحفظ.
 */
export default async function AddPage() {
  const { s, lang } = await getLocale();
  const { state, isLive } = await loadAppState();
  if (!isLive) redirect('/login');

  const budget = computeBudget(state, monthKeyOf(new Date()));
  const statuses = Object.fromEntries(
    budget.categories.map((c) => [c.categoryId, { limit: c.limit, spent: c.spent }]),
  );

  const categories = state.categories
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order);
  const accounts = state.accounts.filter((a) => !a.archived);

  // آخر حساب صُرف منه، وإلّا أوّل حساب صرفٍ: الادّخار لا يُختار تلقائيًّا.
  const defaultAccountId =
    state.transactions[0]?.accountId ??
    accounts.find((a) => !a.excludeFromSpending)?.id ??
    accounts[0]?.id ??
    '';
  const defaultCategoryId =
    categories.find((c) => c.monthlyLimit === null)?.id ?? categories[0]?.id ?? '';

  return (
    <>
      <h1 className="add-title">{s.nav.add}</h1>
      <AddExpense
        s={s.add}
        common={s.common}
        lang={lang}
        currency={state.income.currency}
        categories={categories}
        accounts={accounts}
        statuses={statuses}
        warnAt={state.alertRules.categoryWarnAt}
        defaultAccountId={defaultAccountId}
        defaultCategoryId={defaultCategoryId}
      />
    </>
  );
}
