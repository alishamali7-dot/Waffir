/**
 * مُوَفِّر — نماذج البيانات
 *
 * قاعدتان تحكمان هذا الملف:
 *
 * ١. لا رقم ولا اسم خاص بمستخدم معيّن هنا. العملة والفئات والدخل
 *    والالتزامات كلها تجي من الإعداد الأول أو يضيفها المستخدم.
 *    البذور المبدئية في templates.ts.
 *
 * ٢. لا ربط مع أي بنك ولا محفظة (Apple/Google/Samsung Pay). الإدخال
 *    يدوي، ومعه استيراد ملف محلي. راجع INTEGRATION.md.
 *
 * المبالغ كلها أعداد صحيحة بأصغر وحدة في العملة، لا كسور عشرية:
 * 1234.567 د.ك = 1234567. الـ float يخرب جمع المال. التنسيق وقت العرض بس.
 */

/** مبلغ بأصغر وحدة في العملة: فلس، هللة، سنت. */
export type Fils = number;

/** ٣ للدينار الكويتي. العملات الأخرى تختلف — انظر CurrencyConfig. */
export const DEFAULT_MINOR_UNITS = 3;

const factor = (minorUnits: number) => Math.pow(10, minorUnits);

export const toFils = (amount: number, minorUnits = DEFAULT_MINOR_UNITS): Fils =>
  Math.round(amount * factor(minorUnits));

export const formatAmount = (f: Fils, minorUnits = DEFAULT_MINOR_UNITS): string =>
  (f / factor(minorUnits)).toFixed(minorUnits);

/** @deprecated استخدم formatAmount — باقية حتى تُحدَّث الشاشات القديمة */
export const formatKWD = (f: Fils): string => formatAmount(f, 3);

// ─── الدخل ───────────────────────────────────────────────────────────

/**
 * العملة تُختار في الإعداد الأول. الاسم `Fils` تاريخي — المقصود
 * أصغر وحدة في أي عملة (فلس، هللة، سنت)، وعددها يحدّده `minorUnits`.
 */
export interface CurrencyConfig {
  /** ISO 4217، مثل "KWD" أو "SAR" أو "USD" */
  code: string;
  /** ما يُعرض بجانب الرقم: "د.ك" */
  symbol: string;
  /** 3 للدينار، 2 لأغلب العملات، 0 لليَن */
  minorUnits: number;
}

/**
 * وضع المستخدم المالي — سؤال الخطوة ٢ في الإعداد.
 * يحدّد الفئات والحدود المبدئية، ولا يقيّده بعدها.
 */
/**
 * الشُرَط سفليّة لا وسطيّة، لتطابق enum القاعدة حرفًا بحرف.
 *
 * كانت `fixed-salary` هنا و`fixed_salary` في Postgres، وكان الـcast
 * في `supabase-source.ts` يخفي الفرق فيعطي قيمة لا تنتمي للنوع. هذا
 * بالضبط ما يُضيّع ساعةً في تتبّع «لماذا لا تظهر الفئات».
 */
export type IncomeShape =
  | 'fixed_salary'   // راتب شهري في يوم معروف
  | 'variable'       // عمل حر، تجارة، عمولة
  | 'allowance'      // مصروف أو مساعدة
  | 'multiple'       // راتب + مصادر أخرى
  | 'none';          // لا دخل مُسجّل — مصاريف فقط

/** مصدر دخل واحد. مستخدم قد يكون عنده أكثر من واحد، أو ولا واحد. */
export interface IncomeSource {
  id: string;
  name: string;
  /** المبلغ المعتاد. undefined للمصادر غير المنتظمة */
  typicalAmount?: Fils;
  /** 1–28 فقط؛ نتجنب 29–31 لأن فبراير. undefined = غير منتظم */
  payDayOfMonth?: number;
  /** الحساب الذي يستلم المبلغ */
  accountId: string;
  /** هذا هو المصدر الذي يبدأ عنده الشهر المالي */
  isPrimary: boolean;
  active: boolean;
}

export interface IncomeProfile {
  shape: IncomeShape;
  sources: IncomeSource[];
  currency: CurrencyConfig;
}

/** كاش، بطاقة، حساب ادخار، محفظة. الناس تفرّق بينها فعلًا. */
export interface Account {
  id: string;
  name: string;
  kind: 'cash' | 'card' | 'savings' | 'wallet' | 'other';
  color: string;
  openingBalance: Fils;
  /** لا يُصرف منه: يُستثنى من "باقي لك هذا الشهر" */
  excludeFromSpending: boolean;
  /** عملة مختلفة عن العملة الأساسية، إن وُجدت */
  currencyCode?: string;
  archived: boolean;
}

/** "2026-11" — مفتاح الشهر. ISO، يترتب أبجديًا = يترتب زمنيًا. */
export type MonthKey = string;

export interface MonthlyIncomeOverride {
  month: MonthKey;
  /** المبلغ الفعلي اللي نزل هذا الشهر من المصدر الأساسي */
  actualSalary: Fils;
  /** إضافات غير متكررة: مكافأة، ساعات إضافية، بدل */
  extras: Array<{ id: string; label: string; amount: Fils }>;
  note?: string;
}

// ─── الالتزامات الثابتة ───────────────────────────────────────────────

export type CommitmentKind =
  | 'rent'
  | 'loan'
  | 'insurance'
  | 'salary-paid'   // معاش خادمة، سواق…
  | 'allowance'     // مصروف ثابت لأحد أفراد الأسرة
  | 'utility'       // فواتير
  | 'rotating-fund' // جمعية
  | 'education'
  | 'other';

export interface FixedCommitment {
  id: string;
  name: string;
  kind: CommitmentKind;
  amount: Fils;
  /** تقديري (مثل الجمعية) → لا تنبّه لو اختلف المبلغ شوي */
  isApproximate: boolean;
  /** يُخصم تلقائيًا أول الشهر بدون تأكيد المستخدم */
  autoDeduct: boolean;
  /** مُعطّل مؤقتًا بدون حذف التاريخ */
  active: boolean;
  startedOn?: string; // ISO date
}

/** التزام له نهاية: قسط أثاث، جهاز، دَين… */
export interface Installment {
  id: string;
  name: string;
  /** الأصل كامل — اتركه undefined لو المستخدم يعرف المتبقي بس */
  principal?: Fils;
  /** المتبقي الآن. هذا هو الحقل الوحيد المطلوب. */
  remaining: Fils;
  /** القسط الشهري. undefined = المستخدم ما حدّده بعد */
  monthlyAmount?: Fils;
  /** يُحسب من remaining / monthlyAmount لو الاثنين موجودين */
  expectedEndMonth?: MonthKey;
  active: boolean;
}

/**
 * مصروف موسمي/سنوي (رسوم مدرسة، تأمين سيارة، سفر الصيف).
 * التطبيق يقسّمه على 12 ويحجزه شهريًا حتى لا يفاجئ المستخدم.
 */
export interface SinkingFund {
  id: string;
  name: string;
  totalAmount: Fils;
  dueMonth: MonthKey;
  /** المتجمّع حتى الآن */
  accrued: Fils;
  monthsToSpread: number;
  active: boolean;
}

// ─── المصاريف المتغيرة ────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  /** لون ثابت للفئة — نفسه في كل شاشة (bars، donut، legend) */
  color: string;
  /**
   * مسار SVG بخط واحد (viewBox 24×24). المستخدم يختاره من شبكة
   * أيقونات. لا إيموجي: شكله يختلف بين الأجهزة وما يقبل تلوينًا.
   */
  icon: string;
  /** حد شهري، أو null = "خذ المتبقي من الراتب" (فئة واحدة بس) */
  monthlyLimit: Fils | null;
  /** كلمات تساعد الإدخال السريع والمستورد على التصنيف */
  keywords: string[];
  /** ترتيب العرض */
  order: number;
  archived: boolean;
}

/**
 * من وين جاءت العملية. قيمتان فقط: التطبيق إدخال يدوي بحت — لا ربط
 * بنكي، ولا محافظ، ولا استيراد ملفات. قرار مقصود لا نقص
 * (انظر INTEGRATION.md).
 */
export type TxSource =
  | 'manual'      // لوحة الأرقام أو الإدخال النصي
  | 'recurring';  // مولّد من التزام ثابت أو قسط

export interface Transaction {
  id: string;
  /** ISO datetime */
  occurredAt: string;
  amount: Fils;
  /** سالب = دخل/استرجاع */
  direction: 'debit' | 'credit';
  description: string;
  categoryId: string | null;
  /** من أي حساب خرج أو فيه دخل */
  accountId: string;
  /**
   * تحويل بين حسابين: ليس مصروفًا ولا دخلًا، ولا يُحسب على أي فئة
   * ولا على الميزانية. أكثر نقطة يغلط فيها الناس في هذي التطبيقات.
   */
  transferToAccountId?: string;
  source: TxSource;
  /** النص الأصلي من الكشف أو من إدخال المستخدم — للمراجعة وللتعلّم */
  rawText?: string;
  /** صنّفه النظام ولم يؤكّده المستخدم بعد */
  needsReview: boolean;
  /** بصمة للتخلص من التكرار: hash(date + amount + normalized description) */
  dedupeKey: string;
  /** لو المستخدم غيّر الفئة، نخزّن القديمة لتحسين التصنيف */
  reclassifiedFrom?: string;
}

// ─── الادخار ─────────────────────────────────────────────────────────

export type SavingsCadence = 'daily' | 'weekly' | 'monthly';

export interface SavingsGoal {
  id: string;
  name: string;
  color: string;
  cadence: SavingsCadence;
  /** المبلغ لكل وحدة من الـ cadence (41 د.ك يوميًا = 41000 فلس daily) */
  amountPerPeriod: Fils;
  /** الحساب الذي يتجمّع فيه الهدف */
  accountId?: string;
  targetAmount?: Fils;
  targetDate?: string; // ISO date
  active: boolean;
}

/** سجل حفظ واحد — يوم واحد لهدف يومي. */
export interface SavingsDeposit {
  goalId: string;
  /** ISO date، بدون وقت — مفتاح فريد مع goalId */
  date: string;
  amount: Fils;
  /** confirmed = المستخدم أكّد، auto = خُصم تلقائيًا */
  via: 'confirmed' | 'auto';
}

/** حالة هدف محسوبة — لا تُخزّن، تُشتق. */
export interface SavingsStatus {
  goalId: string;
  month: MonthKey;
  monthlyTarget: Fils;
  savedThisMonth: Fils;
  lifetimeBalance: Fils;
  /** للـ cadence='daily': عدد الأيام المحفوظة من أيام الشهر المنقضية */
  periodsHit: number;
  periodsElapsed: number;
  periodsInMonth: number;
  currentStreak: number;
  /** متأخر بهذا المبلغ عن الجدول */
  behindBy: Fils;
}

// ─── الميزانية المحسوبة ───────────────────────────────────────────────

export interface CategoryStatus {
  categoryId: string;
  limit: Fils;
  spent: Fils;
  remaining: Fils;
  /** 0–1، قد يتجاوز 1 */
  ratio: number;
  state: 'ok' | 'near' | 'over';
}

export interface MonthBudget {
  month: MonthKey;
  income: Fils;
  fixedTotal: Fils;
  installmentsTotal: Fils;
  sinkingTotal: Fils;
  savingsTotal: Fils;
  /** مجموع الحدود للفئات اللي لها حد */
  allocatedLimits: Fils;
  /** income − كل ما فوق = حد فئة "المتبقي" */
  unallocated: Fils;
  categories: CategoryStatus[];
  spentTotal: Fils;
}

// ─── التنبيهات ───────────────────────────────────────────────────────

export interface AlertRule {
  /** نسبة من الحد تُشعل التنبيه (0.85 = ٨٥٪) */
  categoryWarnAt: number;
  duplicateSubscriptions: boolean;
  dailySavingsReminderAt: string | null; // "21:00"
  salaryDayRollover: boolean;
}

export type AlertKind =
  | 'category-near'
  | 'category-over'
  | 'duplicate-subscription'
  | 'savings-missed'
  | 'sinking-due-soon'
  | 'income-missing';

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  /** الفئة/الهدف/الالتزام المعني */
  subjectId?: string;
  raisedAt: string;
  dismissedAt?: string;
}

// ─── كل شي ───────────────────────────────────────────────────────────

export interface AppState {
  income: IncomeProfile;
  incomeOverrides: Record<MonthKey, MonthlyIncomeOverride>;
  accounts: Account[];
  commitments: FixedCommitment[];
  installments: Installment[];
  sinkingFunds: SinkingFund[];
  categories: Category[];
  goals: SavingsGoal[];
  deposits: SavingsDeposit[];
  transactions: Transaction[];
  alertRules: AlertRule;
  alerts: Alert[];
  /** الوضع المختار في الإعداد — لمعرفة من وين جاءت الافتراضات */
  seededFrom?: IncomeShape;
  schemaVersion: 1;
}
