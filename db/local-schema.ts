/**
 * السكيما المحلّية (SQLite على الجهاز).
 *
 * ## القرار: أعمدة للاستعلام، و JSON للبقيّة
 *
 * كلّ جدول محلّي فيه الأعمدة التي **نُرشّح أو نُرتّب بها** فقط، ومعها
 * عمود `data` يحمل بقيّة الصفّ كما هو JSON.
 *
 * السبب أنّ البديل — مرآة كاملة بكلّ أعمدة السيرفر — يخلق صنفًا من
 * الأعطال لا يظهر إلّا عند المستخدم: تضيف عمودًا في Supabase، فتنكسر
 * المزامنة على كلّ جهاز لم يُحدِّث التطبيق، أو أسوأ: تُكتب الصفوف
 * ناقصةً بهدوء. مع `data` يمرّ العمود الجديد من غير مايقريشن محلّيّ،
 * ويظهر وحده متى قرأه الكود.
 *
 * والثمن أنّ الجمع والتصفية لا يصيران في SQL. وهذا مقبول هنا لأنّ
 * [`budget.ts`](../budget.ts) يحسب في JavaScript من صفوف محمَّلة أصلًا،
 * لا بـ`SUM()`. **متى يُراجَع هذا القرار:** إن بلغت العمليات عشرات
 * الألوف وصار تحميل شهر ثقيلًا، تُرقّى الأعمدة المطلوبة من `data` إلى
 * أعمدة حقيقية — ويبقى `data` للبقيّة.
 *
 * الأعمدة الحقيقية في كلّ جدول:
 *   id, user_id, updated_at, deleted_at, _dirty
 * ومعها ما يحتاجه كلّ جدول للترتيب أو الربط.
 */

import { TABLE_ORDER, SINGLETON_TABLE } from '../sync/plan';

/** أعمدة إضافية لكل جدول، فوق المشتركة. */
const EXTRA_COLUMNS: Record<string, string[]> = {
  transactions: [
    'occurred_at TEXT NOT NULL',
    'account_id TEXT',
    'category_id TEXT',
    'kind TEXT NOT NULL DEFAULT \'expense\'',
    'amount INTEGER NOT NULL DEFAULT 0',
  ],
  savings_deposits: ['goal_id TEXT NOT NULL', 'deposit_date TEXT NOT NULL'],
  income_overrides: ['month TEXT NOT NULL'],
  categories: ['sort_order INTEGER NOT NULL DEFAULT 0', 'archived INTEGER NOT NULL DEFAULT 0'],
  accounts: ['sort_order INTEGER NOT NULL DEFAULT 0', 'archived INTEGER NOT NULL DEFAULT 0'],
  savings_goals: ['active INTEGER NOT NULL DEFAULT 1'],
  fixed_commitments: ['active INTEGER NOT NULL DEFAULT 1'],
  installments: ['active INTEGER NOT NULL DEFAULT 1'],
  sinking_funds: ['active INTEGER NOT NULL DEFAULT 1', 'due_month TEXT'],
  income_sources: ['active INTEGER NOT NULL DEFAULT 1', 'is_primary INTEGER NOT NULL DEFAULT 0'],
  alerts: ['raised_at TEXT', 'dismissed_at TEXT'],
};

/** فهارس فوق الفهرس الأساسيّ وفهرس المزامنة. */
const EXTRA_INDEXES: Record<string, string[]> = {
  transactions: [
    'CREATE INDEX IF NOT EXISTS tx_month ON transactions (user_id, occurred_at DESC) WHERE deleted_at IS NULL',
    'CREATE INDEX IF NOT EXISTS tx_category ON transactions (user_id, category_id, occurred_at DESC) WHERE deleted_at IS NULL',
  ],
  savings_deposits: [
    'CREATE INDEX IF NOT EXISTS dep_goal ON savings_deposits (user_id, goal_id, deposit_date DESC) WHERE deleted_at IS NULL',
  ],
};

function createTable(table: string): string[] {
  const extra = EXTRA_COLUMNS[table] ?? [];
  const cols = [
    'id TEXT PRIMARY KEY NOT NULL',
    'user_id TEXT NOT NULL',
    "updated_at TEXT NOT NULL DEFAULT ''",
    'deleted_at TEXT',
    // 1 = معدَّل محليًّا ولم يُدفع. الاسم بشرطة سفلية ليُستبعد
    // تلقائيًّا عند الدفع (انظر forPush في sync/plan.ts).
    '_dirty INTEGER NOT NULL DEFAULT 0',
    // بقيّة الصفّ كما جاء من السيرفر أو كما كتبه المستخدم
    "data TEXT NOT NULL DEFAULT '{}'",
    ...extra,
  ];
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (${cols.join(', ')})`,
    // الفهرس الذي يخدم السحب والدفع في كلّ جدول
    `CREATE INDEX IF NOT EXISTS ${table}_sync ON ${table} (user_id, updated_at)`,
    `CREATE INDEX IF NOT EXISTS ${table}_dirty ON ${table} (_dirty) WHERE _dirty = 1`,
    ...(EXTRA_INDEXES[table] ?? []),
  ];
}

export const SCHEMA_VERSION = 1;

export const LOCAL_SCHEMA: string[] = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = OFF',

  ...[...TABLE_ORDER, SINGLETON_TABLE].flatMap(createTable),

  // مؤشّر المزامنة لكلّ جدول. منفصل عن الجداول عن قصد: مسح جدول
  // لإعادة مزامنته لا يمسّ مؤشّرات البقيّة.
  `CREATE TABLE IF NOT EXISTS sync_cursors (
     table_name TEXT PRIMARY KEY NOT NULL,
     cursor TEXT NOT NULL,
     synced_at TEXT NOT NULL
   )`,

  // طابور ما رفضه السيرفر، لعرضه للمستخدم بدل الصمت
  `CREATE TABLE IF NOT EXISTS sync_rejects (
     id TEXT NOT NULL,
     table_name TEXT NOT NULL,
     error TEXT NOT NULL,
     at TEXT NOT NULL,
     PRIMARY KEY (table_name, id)
   )`,

  `CREATE TABLE IF NOT EXISTS meta (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   )`,
];

/**
 * `foreign_keys = OFF` مقصود.
 *
 * السحب يأتي بالجداول مرتّبةً (الآباء أوّلًا)، لكن صفحة قد تنقطع في
 * منتصف الترتيب إن فشلت الشبكة، فيبقى ابن بلا أب مؤقّتًا. تفعيل
 * المفاتيح يرفض الصفّ ويُفقده؛ وتعطيلها يقبله وتُصلحه المزامنة
 * القادمة. **اتّساق الملكية مفروض على السيرفر** بمفاتيح مركّبة
 * (migration 0002)، وهو الموضع الذي يجب أن يُفرض فيه.
 */
export const FOREIGN_KEYS_OFF_REASON =
  'السحب قد ينقطع بين الأب والابن؛ القيود مفروضة على السيرفر';
