/**
 * حساب ميزانية الشهر. دالة نقية — نفس المدخلات = نفس المخرجات.
 * كل الحساب بالفلس (أعداد صحيحة) حتى لا تتسرّب أخطاء الـ float.
 */

import {
  AppState,
  CategoryStatus,
  Fils,
  MonthBudget,
  MonthKey,
  SavingsGoal,
  SavingsStatus,
} from './types';

export const monthKeyOf = (d: Date): MonthKey =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const daysInMonth = (month: MonthKey): number => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const sum = (xs: Fils[]): Fils => xs.reduce((a, b) => a + b, 0);

/** هدف الشهر لهدف ادخار — daily يتبع عدد أيام الشهر الفعلي. */
export function monthlyTargetOf(goal: SavingsGoal, month: MonthKey): Fils {
  switch (goal.cadence) {
    case 'daily':
      return goal.amountPerPeriod * daysInMonth(month);
    case 'weekly':
      // أسابيع كاملة في الشهر، مقرّبة — الشهر ليس ٤ أسابيع بالضبط
      return Math.round((goal.amountPerPeriod * daysInMonth(month)) / 7);
    case 'monthly':
      return goal.amountPerPeriod;
  }
}

/**
 * دخل الشهر: تعديل الشهر إن وُجد، وإلا مجموع المصادر المعتادة.
 * مصدر بلا `typicalAmount` (دخل غير منتظم) لا يُحسب هنا — يظهر فقط
 * حين تُسجّل عملية دخل فعلية، فلا نبني حدودًا على مبلغ متوقَّع.
 */
export function incomeFor(state: AppState, month: MonthKey): Fils {
  const override = state.incomeOverrides[month];
  if (override) {
    return override.actualSalary + sum(override.extras.map((e) => e.amount));
  }
  return sum(
    state.income.sources
      .filter((s) => s.active && s.typicalAmount != null)
      .map((s) => s.typicalAmount!),
  );
}

export function computeBudget(state: AppState, month: MonthKey): MonthBudget {
  const income = incomeFor(state, month);

  const fixedTotal = sum(
    state.commitments.filter((c) => c.active).map((c) => c.amount),
  );

  const installmentsTotal = sum(
    state.installments
      .filter((i) => i.active && i.monthlyAmount != null)
      .map((i) => Math.min(i.monthlyAmount!, i.remaining)),
  );

  const sinkingTotal = sum(
    state.sinkingFunds
      .filter((f) => f.active)
      .map((f) => Math.ceil(f.totalAmount / Math.max(1, f.monthsToSpread))),
  );

  const activeGoals = state.goals.filter((g) => g.active);
  const savingsTotal = sum(activeGoals.map((g) => monthlyTargetOf(g, month)));

  const cats = state.categories.filter((c) => !c.archived);
  const allocatedLimits = sum(
    cats.map((c) => c.monthlyLimit ?? 0),
  );

  const unallocated = Math.max(
    0,
    income - fixedTotal - installmentsTotal - sinkingTotal - savingsTotal - allocatedLimits,
  );

  const spentByCat = new Map<string, Fils>();
  for (const tx of state.transactions) {
    if (!tx.categoryId) continue;
    if (!tx.occurredAt.startsWith(month)) continue;
    // التحويل بين حسابين ليس صرفًا: المبلغ ما خرج من فلوسك.
    if (tx.transferToAccountId) continue;
    const signed = tx.direction === 'credit' ? -tx.amount : tx.amount;
    spentByCat.set(tx.categoryId, (spentByCat.get(tx.categoryId) ?? 0) + signed);
  }

  const warnAt = state.alertRules.categoryWarnAt;

  const categories: CategoryStatus[] = cats.map((c) => {
    const limit = c.monthlyLimit ?? unallocated;
    const spent = spentByCat.get(c.id) ?? 0;
    const ratio = limit > 0 ? spent / limit : 0;
    return {
      categoryId: c.id,
      limit,
      spent,
      remaining: limit - spent,
      ratio,
      /**
       * `>=` لا `>`: بلوغ الحدّ تمامًا ليس اقترابًا منه.
       *
       * كان `>` يعطي حالة «اقترب من الحدّ» مع «المتبقّي ٠٫٠٠٠»،
       * وهما جملتان متناقضتان في سطر واحد. والتصرّف المطلوب عند
       * البلوغ هو التصرّف عند التجاوز نفسه: أوقف الصرف.
       *
       * والاستثناء حدٌّ صفريّ لا يقيس شيئًا: بلا صرفٍ فلا تجاوز (كان
       * `0 >= 0` يعرض كلّ فئةٍ حمراء في حسابٍ جديد)، وبلا دخلٍ أصلًا
       * فالمستخدم يسجّل مصروفاته فقط ولا حدّ يُتجاوز.
       */
      state:
        limit <= 0 && (spent <= 0 || income <= 0)
          ? 'ok'
          : spent >= limit
            ? 'over'
            : ratio >= warnAt
              ? 'near'
              : 'ok',
    };
  });

  return {
    month,
    income,
    fixedTotal,
    installmentsTotal,
    sinkingTotal,
    savingsTotal,
    allocatedLimits,
    unallocated,
    categories,
    spentTotal: sum(categories.map((c) => c.spent)),
  };
}

/** حالة هدف ادخار: كم محفوظ، كم متأخر، وسلسلة الأيام المتواصلة. */
export function computeSavingsStatus(
  state: AppState,
  goalId: string,
  month: MonthKey,
  today: Date,
): SavingsStatus {
  const goal = state.goals.find((g) => g.id === goalId)!;
  const mine = state.deposits.filter((d) => d.goalId === goalId);

  const thisMonth = mine.filter((d) => d.date.startsWith(month));
  const savedThisMonth = sum(thisMonth.map((d) => d.amount));
  const lifetimeBalance = sum(mine.map((d) => d.amount));

  const periodsInMonth = goal.cadence === 'daily' ? daysInMonth(month) : 1;
  const isCurrentMonth = monthKeyOf(today) === month;
  const periodsElapsed =
    goal.cadence !== 'daily'
      ? 1
      : isCurrentMonth
        ? today.getDate()
        : periodsInMonth;

  const hitDates = new Set(thisMonth.map((d) => d.date));
  const monthlyTarget = monthlyTargetOf(goal, month);
  const expectedByNow =
    goal.cadence === 'daily' ? goal.amountPerPeriod * periodsElapsed : monthlyTarget;

  // السلسلة: نرجع من آخر يوم منقضٍ للخلف حتى أول يوم فايت
  let streak = 0;
  for (let day = periodsElapsed; day >= 1; day--) {
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    if (hitDates.has(iso)) streak++;
    else break;
  }

  return {
    goalId,
    month,
    monthlyTarget,
    savedThisMonth,
    lifetimeBalance,
    periodsHit: hitDates.size,
    periodsElapsed,
    periodsInMonth,
    currentStreak: streak,
    behindBy: Math.max(0, expectedByNow - savedThisMonth),
  };
}
