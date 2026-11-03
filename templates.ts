/**
 * بذور الإعداد الأول.
 *
 * هذا الملف هو السبب اللي يخلّي التطبيق صالح لأي أحد: كل شي هنا بيانات
 * أولية تُنسخ لحالة المستخدم في أول تشغيل، ثم يعدّلها كيف ما يبي. ولا شي
 * منها مكتوب داخل منطق التطبيق.
 *
 * السؤال في الخطوة ٢ من الإعداد هو «كيف تجيك فلوسك؟» — جوابه IncomeShape،
 * وهو اللي يحدّد الفئات والحدود المبدئية. تبي وضعًا جديدًا؟ أضِف عنصرًا
 * للمصفوفة؛ ما يحتاج تعديل أي كود ثاني.
 */

import {
  Account,
  AppState,
  Category,
  CurrencyConfig,
  FixedCommitment,
  IncomeShape,
  IncomeSource,
  SavingsGoal,
  toFils,
} from './types';

// ─── العملات ─────────────────────────────────────────────────────────

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'KWD', symbol: 'د.ك', minorUnits: 3 },
  { code: 'SAR', symbol: 'ر.س', minorUnits: 2 },
  { code: 'AED', symbol: 'د.إ', minorUnits: 2 },
  { code: 'BHD', symbol: 'د.ب', minorUnits: 3 },
  { code: 'OMR', symbol: 'ر.ع', minorUnits: 3 },
  { code: 'QAR', symbol: 'ر.ق', minorUnits: 2 },
  { code: 'EGP', symbol: 'ج.م', minorUnits: 2 },
  { code: 'JOD', symbol: 'د.أ', minorUnits: 3 },
  { code: 'USD', symbol: '$', minorUnits: 2 },
  { code: 'EUR', symbol: '€', minorUnits: 2 },
];

// ─── الألوان والأيقونات ──────────────────────────────────────────────

/** لون لكل فئة، يتكرّر نفسه في كل شاشة: أعمدة، شرائح، نقاط، شارات. */
export const PALETTE = {
  food: '#E8590C',
  cafe: '#C2255C',
  transport: '#1864AB',
  bills: '#0B7285',
  shopping: '#9C36B5',
  health: '#2B7A3D',
  kids: '#6741D9',
  fun: '#5C940D',
  other: '#6B6257',
  savings: '#C2185B',
} as const;

/**
 * مسارات SVG بخط واحد (viewBox 24×24، stroke). لا إيموجي — الإيموجي
 * يختلف شكله بين الأجهزة وما يقبل تلوينًا.
 */
export const ICONS = {
  food: 'M7 3v7a2 2 0 0 0 4 0V3M9 10v11M16 3c-1.4 2-1.4 5 0 7v11',
  cafe: 'M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8zM16 9h2a2 2 0 0 1 0 4h-2M4 21h13',
  transport: 'M5 16v-3l2-5h10l2 5v3M3 16h18M7 16v2M17 16v2',
  bills: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  shopping: 'M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2',
  health: 'M12 5v14M5 12h14',
  kids: 'M12 3l8 4v5c0 4.4-3.2 7.9-8 9-4.8-1.1-8-4.6-8-9V7z',
  fun: 'M4 7h16v11H4zM9 12l5 3-5 3z',
  savings: 'M12 21V9M7 14l5-5 5 5M4 4h16',
  home: 'M3 10.5 12 3l9 7.5M5 10v10h14V10',
  other: 'M5 12h.01M12 12h.01M19 12h.01',
} as const;

// ─── مُنشئات مختصرة ──────────────────────────────────────────────────

const cat = (
  id: string,
  name: string,
  color: string,
  icon: string,
  /** null = خذ المتبقي من الدخل. فئة واحدة فقط تكون null */
  limit: number | null,
  keywords: string[],
  order: number,
  minorUnits: number,
): Category => ({
  id,
  name,
  color,
  icon,
  monthlyLimit: limit === null ? null : toFils(limit, minorUnits),
  keywords,
  order,
  archived: false,
});

const account = (
  id: string,
  name: string,
  kind: Account['kind'],
  color: string,
  excludeFromSpending = false,
): Account => ({
  id,
  name,
  kind,
  color,
  openingBalance: 0,
  excludeFromSpending,
  archived: false,
});

/** كل مستخدم يبدأ بهذين: كاش وبطاقة. هو يضيف الباقي. */
const BASE_ACCOUNTS: Account[] = [
  account('cash', 'كاش', 'cash', '#5C940D'),
  account('card', 'البطاقة الرئيسية', 'card', '#1864AB'),
];

/**
 * الفئات المبدئية. أسماء عامة تصلح لأي بلد وأي أسرة — لا أسماء أشخاص
 * ولا التزامات خاصة. الحدود نسبة من الدخل، لا مبالغ مكتوبة.
 */
function baseCategories(income: number, minorUnits: number): Category[] {
  const pct = (p: number) => Math.round(income * p);
  return [
    cat('food', 'أكل وشراب', PALETTE.food, ICONS.food, pct(0.05), ['مقاضي', 'سوق', 'لحم', 'دجاج', 'خضار', 'مخبز'], 1, minorUnits),
    cat('cafe', 'مطاعم وقهوة', PALETTE.cafe, ICONS.cafe, pct(0.022), ['قهوة', 'كافي', 'مطعم', 'برجر', 'شاورما', 'حلويات', 'طلبات'], 2, minorUnits),
    cat('transport', 'مواصلات', PALETTE.transport, ICONS.transport, pct(0.022), ['بنزين', 'وقود', 'غسيل', 'تاير', 'ورشة', 'موقف', 'تاكسي'], 3, minorUnits),
    // حدّ حقيقيّ لا `null`: الإيجار يسكن الالتزامات الثابتة، وهذه
    // الفئة للفواتير التي يسجّلها المستخدم. وفئة واحدة فقط تأخذ
    // المتبقّي، وهي «أخرى» أدناه — القاعدة تفرض ذلك بفهرس فريد.
    cat('bills', 'فواتير وإيجار', PALETTE.bills, ICONS.bills, pct(0.04), ['كهرباء', 'ماء', 'إنترنت', 'جوال'], 4, minorUnits),
    cat('shopping', 'تسوّق', PALETTE.shopping, ICONS.shopping, pct(0.032), ['ملابس', 'أحذية', 'مول', 'أثاث', 'إلكترونيات'], 5, minorUnits),
    cat('health', 'صحة', PALETTE.health, ICONS.health, pct(0.027), ['صيدلية', 'دكتور', 'عيادة', 'علاج', 'حلاق', 'مختبر'], 6, minorUnits),
    cat('kids', 'أطفال وتعليم', PALETTE.kids, ICONS.kids, pct(0.027), ['حفاظ', 'حليب', 'ألعاب', 'مدرسة', 'روضة', 'دورة'], 7, minorUnits),
    cat('fun', 'ترفيه', PALETTE.fun, ICONS.fun, pct(0.016), ['اشتراك', 'سينما', 'رحلة', 'لعبة', 'هدية'], 8, minorUnits),
    cat('other', 'أخرى', PALETTE.other, ICONS.other, null, [], 9, minorUnits),
  ];
}

// ─── الأوضاع ─────────────────────────────────────────────────────────

export interface SituationSeed {
  shape: IncomeShape;
  name: string;
  note: string;
  /** ما يجهّزه هذا الوضع — نُعرضه للمستخدم قبل ما يختار */
  gives: string;
  popular?: boolean;
  build: (income: number, minorUnits: number) => Pick<
    AppState,
    'accounts' | 'categories' | 'commitments' | 'goals' | 'installments' | 'sinkingFunds'
  >;
}

const emergencyGoal = (income: number, minorUnits: number): SavingsGoal => ({
  id: 'emergency',
  name: 'صندوق الطوارئ',
  color: PALETTE.savings,
  cadence: 'monthly',
  amountPerPeriod: toFils(Math.round(income * 0.1), minorUnits),
  accountId: 'savings',
  active: true,
});

export const SITUATIONS: SituationSeed[] = [
  {
    shape: 'fixed_salary',
    name: 'راتب شهري ثابت',
    note: 'ينزل في يوم معروف كل شهر',
    gives: 'يجهّز: التزامات ثابتة + حدود شهرية + شهر مالي يبدأ يوم الراتب',
    popular: true,
    build: (income, mu) => ({
      accounts: [...BASE_ACCOUNTS, account('savings', 'حساب الادخار', 'savings', PALETTE.savings, true)],
      categories: baseCategories(income, mu),
      // بنود فاضية بأسماء شائعة: المستخدم يكتب مبلغه أو يحذف البند.
      commitments: [
        blankCommitment('rent', 'إيجار', 'rent'),
        blankCommitment('utilities', 'كهرباء وماء', 'utility'),
        blankCommitment('phone', 'إنترنت وجوال', 'utility'),
      ],
      goals: [emergencyGoal(income, mu)],
      installments: [],
      sinkingFunds: [],
    }),
  },
  {
    shape: 'variable',
    name: 'دخل متغيّر',
    note: 'عمل حر، تجارة، عمولة — يختلف كل شهر',
    gives: 'يجهّز: حدود بنسبة من الدخل الفعلي، لا مبالغ ثابتة',
    build: (income, mu) => ({
      accounts: [...BASE_ACCOUNTS, account('savings', 'حساب الادخار', 'savings', PALETTE.savings, true)],
      categories: baseCategories(income, mu),
      commitments: [blankCommitment('rent', 'إيجار', 'rent')],
      // دخل متغيّر ⇒ صندوق طوارئ أكبر، ٣ شهور مصاريف هو العُرف
      goals: [
        {
          ...emergencyGoal(income, mu),
          amountPerPeriod: toFils(Math.round(income * 0.15), mu),
          targetAmount: toFils(Math.round(income * 3), mu),
        },
      ],
      installments: [],
      sinkingFunds: [],
    }),
  },
  {
    shape: 'allowance',
    name: 'مصروف أو مساعدة',
    note: 'طالب، أو يجيك مبلغ من أحد',
    gives: 'يجهّز: فئات أقل وأبسط، بدون التزامات كبيرة',
    build: (income, mu) => ({
      accounts: BASE_ACCOUNTS,
      categories: baseCategories(income, mu).filter(
        (c) => !['kids', 'bills', 'health'].includes(c.id),
      ),
      commitments: [],
      goals: [],
      installments: [],
      sinkingFunds: [],
    }),
  },
  {
    shape: 'multiple',
    name: 'مصادر متعددة',
    note: 'راتب ومعه دخل ثانٍ أو أكثر',
    gives: 'يجهّز: مصادر دخل منفصلة، كل واحد بيومه',
    build: (income, mu) => ({
      accounts: [...BASE_ACCOUNTS, account('savings', 'حساب الادخار', 'savings', PALETTE.savings, true)],
      categories: baseCategories(income, mu),
      commitments: [blankCommitment('rent', 'إيجار', 'rent')],
      goals: [emergencyGoal(income, mu)],
      installments: [],
      sinkingFunds: [],
    }),
  },
  {
    shape: 'none',
    name: 'أبدأ من الصفر',
    note: 'بدون دخل مُسجّل — أسجّل مصاريفي بس',
    gives: 'يجهّز: فئة واحدة، وتضيف الباقي بنفسك',
    build: (income, mu) => ({
      accounts: BASE_ACCOUNTS,
      categories: [cat('other', 'أخرى', PALETTE.other, ICONS.other, null, [], 1, mu)],
      commitments: [],
      goals: [],
      installments: [],
      sinkingFunds: [],
    }),
  },
];

/**
 * بند بمبلغ صفر. نعرض الاسم ويكتب المستخدم مبلغه.
 * لا نخترع رقمًا — رقم مخترع أسوأ من خانة فاضية.
 */
function blankCommitment(
  id: string,
  name: string,
  kind: FixedCommitment['kind'],
): FixedCommitment {
  return {
    id,
    name,
    kind,
    amount: 0,
    isApproximate: false,
    autoDeduct: true,
    active: true,
  };
}

// ─── البذرة ──────────────────────────────────────────────────────────

export function seedState(
  shape: IncomeShape,
  /** المبلغ كما كتبه المستخدم. 0 إذا تخطّى الخطوة ٣ */
  incomeAmount: number,
  currencyCode = 'KWD',
  payDayOfMonth = 1,
): AppState {
  const currency =
    CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const situation =
    SITUATIONS.find((s) => s.shape === shape) ??
    SITUATIONS[SITUATIONS.length - 1];

  const parts = situation.build(incomeAmount, currency.minorUnits);

  const sources: IncomeSource[] =
    shape === 'none' || incomeAmount <= 0
      ? []
      : [
          {
            id: 'primary',
            name: shape === 'allowance' ? 'مصروف' : 'الدخل الأساسي',
            typicalAmount: toFils(incomeAmount, currency.minorUnits),
            // الدخل المتغيّر ما له يوم ثابت
            payDayOfMonth: shape === 'variable' ? undefined : payDayOfMonth,
            accountId: 'card',
            isPrimary: true,
            active: true,
          },
        ];

  return {
    income: { shape, sources, currency },
    incomeOverrides: {},
    ...parts,
    deposits: [],
    transactions: [],
    alertRules: {
      categoryWarnAt: 0.85,
      duplicateSubscriptions: true,
      dailySavingsReminderAt: null,
      salaryDayRollover: shape === 'fixed_salary',
    },
    alerts: [],
    seededFrom: shape,
    schemaVersion: 1,
  };
}
