/**
 * عقل المزامنة — دوال نقية بلا شبكة ولا قاعدة.
 *
 * كل قرار صعب في المزامنة هنا، ومُختبَر في plan.test.ts. الطبقة اللي
 * تتكلم مع Supabase و SQLite (sync.ts) ما تقرّر شيئًا، تنفّذ فقط.
 */

// ─── ترتيب الجداول ───────────────────────────────────────────────────

/**
 * الآباء قبل الأبناء. لو دفعنا عملية قبل حسابها، يرفضها السيرفر
 * بخطأ مفتاح أجنبي.
 *
 * الحذف لا يحتاج ترتيبًا معاكسًا: حذفنا soft delete (تحديث
 * `deleted_at`)، والمفاتيح الأجنبية لا تهتم به.
 */
export const TABLE_ORDER = [
  'accounts',
  'categories',
  'savings_goals',
  'income_sources',
  'income_overrides',
  'fixed_commitments',
  'installments',
  'sinking_funds',
  'savings_deposits',
  'transactions',
  'alerts',
] as const;

export type SyncTable = (typeof TABLE_ORDER)[number];

/** `profiles` ليس في القائمة: صف واحد يُنشئه تريقر، ولا insert منه. */
export const SINGLETON_TABLE = 'profiles' as const;

// ─── المؤشّر ─────────────────────────────────────────────────────────

/** صف كما يراه المزامن — أي شي عندنا منه updated_at. */
export interface SyncRow {
  id: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface LocalRow extends SyncRow {
  /** 1 = معدّل محليًّا ولم يُدفع بعد */
  _dirty: 0 | 1;
}

/**
 * المؤشّر الجديد = أكبر updated_at في الصفوف المسحوبة.
 *
 * نقطتان مقصودتان:
 *
 * ١. المؤشّر دائمًا من **ساعة السيرفر** (القيمة في الصف)، لا من
 *    `Date.now()`. ساعة الجوال قد تكون متقدّمة أو متأخرة دقائق،
 *    وأي مؤشّر من ساعة الجهاز يعني تفويت صفوف أو إعادة سحب الكل.
 *
 * ٢. نرجّع القيمة كما هي (نصًّا) ولا نحوّلها لـ Date. Postgres يعطي
 *    دقّة ميكروثانية، و JS Date يحتفظ بالميلي فقط — التحويل يقرّب
 *    ويخلّي المؤشّر يفوّت صفًّا كُتب في نفس الميلي ثانية.
 *
 * ولهذا السحب يستخدم `gte` لا `gt`: صفوف الحدّ تُسحب مرة ثانية، وهذا
 * بلا ضرر لأن الكتابة المحلية upsert.
 */
export function nextCursor(rows: SyncRow[], current: string | null): string | null {
  let max = current;
  for (const row of rows) {
    if (!row.updated_at) continue;
    if (max === null || compareTimestamps(row.updated_at, max) > 0) {
      max = row.updated_at;
    }
  }
  return max;
}

/**
 * مقارنة طابعين زمنيين من Postgres نصًّا.
 *
 * الصيغة "2026-11-03T12:00:00.123456+00:00". المقارنة النصية المباشرة
 * تفشل لأن الكسر العشري متغيّر الطول: ".5" أكبر نصًّا من ".123456"
 * وهو أصغر زمنيًّا. فنفصل الكسر ونبطّنه لـ ٦ خانات.
 */
export function compareTimestamps(a: string, b: string): number {
  const [aMain, aFrac] = splitFraction(a);
  const [bMain, bFrac] = splitFraction(b);
  if (aMain !== bMain) return aMain < bMain ? -1 : 1;
  if (aFrac !== bFrac) return aFrac < bFrac ? -1 : 1;
  return 0;
}

function splitFraction(ts: string): [string, string] {
  const dot = ts.indexOf('.');
  if (dot === -1) return [normalizeZone(ts), '000000'];
  let i = dot + 1;
  while (i < ts.length && ts[i] >= '0' && ts[i] <= '9') i++;
  const frac = ts.slice(dot + 1, i).padEnd(6, '0').slice(0, 6);
  return [normalizeZone(ts.slice(0, dot) + ts.slice(i)), frac];
}

/** "+00:00" و "Z" و "" نفس الشي من السيرفر — نوحّدها قبل المقارنة. */
function normalizeZone(s: string): string {
  return s.replace(/(Z|[+-]00:?00)$/, '');
}

// ─── حلّ التعارض ─────────────────────────────────────────────────────

export type Resolution = 'take_remote' | 'keep_local';

/**
 * من يفوز: الصف القادم من السيرفر أو الموجود محليًّا؟
 *
 * **المزامنة تدفع قبل أن تسحب.** هذا الترتيب هو ما يجعل القاعدة
 * بسيطة: بوقت السحب، كل تعديل محلي ناجح صار مدفوعًا و `_dirty = 0`.
 * فالصف اللي لا يزال `_dirty` معناه أن دفعه **فشل** (انقطع الإنترنت،
 * رفضه قيد) — فنتمسّك به ونعيد المحاولة في المزامنة القادمة، ولا
 * نسمح لنسخة السيرفر القديمة أن تمسح كتابة المستخدم.
 *
 * لاحظ أننا لا نقارن `updated_at` المحلي بالبعيد أبدًا: المحلي من ساعة
 * الجهاز والبعيد من ساعة السيرفر، ومقارنتهما مقارنة ساعتين مختلفتين.
 *
 * الحدّ: مستخدم واحد على عدة أجهزة — كافٍ. لو أضفت ميزانية مشتركة بين
 * شخصين، last-write-wins ما يكفي وتحتاج دمجًا على مستوى الحقل.
 */
export function resolve(local: LocalRow | undefined, remote: SyncRow): Resolution {
  if (!local) return 'take_remote';
  if (local._dirty === 1) return 'keep_local';
  return 'take_remote';
}

// ─── التقطيع ─────────────────────────────────────────────────────────

/**
 * الدفع على دفعات. شهر كامل من العمليات قد يكون مئات الصفوف، ودفعها
 * في طلب واحد يصطدم بحدود حجم الطلب وينهار كله بخطأ واحد.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk: size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export const PUSH_CHUNK = 200;

// ─── تجهيز الصف للدفع ────────────────────────────────────────────────

/**
 * الأعمدة اللي تبدأ بـ `_` محلية فقط — لو أرسلناها رفض Postgres الصف
 * بعمود غير موجود. و`updated_at` نحذفه عمدًا: تريقر السيرفر يضبطه،
 * فإرسال قيمة من ساعة الجهاز يعني مؤشّرًا كاذبًا للأجهزة الثانية.
 */
export function forPush<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.startsWith('_')) continue;
    if (k === 'updated_at') continue;
    out[k] = v;
  }
  return out;
}
