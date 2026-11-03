-- مُوَفِّر — السكيما الأولى
--
-- ثلاثة قرارات تحكم كل جدول هنا:
--
-- ١. المبالغ bigint بأصغر وحدة في العملة (فلس/هللة/سنت). لا numeric ولا
--    float. 1234.567 د.ك = 1234567. سبب: الفاصلة العائمة تخرّب الجمع،
--    و numeric أثقل بلا داعٍ لأعداد صحيحة.
--
-- ٢. المفاتيح uuid يولّدها **الجهاز** لا السيرفر. التطبيق offline-first:
--    المستخدم يسجّل مصروفًا بدون إنترنت، فلازم يكون له id فورًا. السيرفر
--    يحترم الـ id القادم من العميل (default موجود للراحة فقط).
--
-- ٣. كل جدول فيه updated_at و deleted_at. الحذف soft delete: بدون شاهدة
--    قبر (tombstone) الحذف على جهاز لا يصل للأجهزة الثانية — يرجع الصف
--    في المزامنة القادمة. والمزامنة last-write-wins على updated_at.
--
-- RLS مفعّل على كل جدول. التطبيق للبلايستور: كل مستخدم يرى صفوفه فقط.

-- ─── أدوات مشتركة ──────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── أنواع ─────────────────────────────────────────────────────────

create type public.income_shape as enum (
  'fixed_salary',   -- راتب شهري في يوم معروف
  'variable',       -- عمل حر، تجارة، عمولة
  'allowance',      -- مصروف أو مساعدة
  'multiple',       -- راتب + مصادر أخرى
  'none'            -- لا دخل مُسجّل
);

create type public.account_kind as enum (
  'cash', 'card', 'savings', 'wallet', 'other'
);

create type public.commitment_kind as enum (
  'rent', 'loan', 'insurance', 'salary_paid', 'allowance',
  'utility', 'rotating_fund', 'education', 'other'
);

create type public.tx_kind as enum (
  'expense',
  'income',
  'transfer'   -- بين حسابين. ليس صرفًا ولا دخلًا ولا يُحسب على فئة.
);

-- لا ربط بنكي ولا محافظ ولا استيراد ملفات: قرار المالك ٣ نوفمبر ٢٠٢٦.
-- القيمتان هما كل ما يحتاجه التطبيق (راجع INTEGRATION.md).
create type public.tx_source as enum (
  'manual',     -- لوحة الأرقام أو الإدخال النصي
  'recurring'   -- مولّد من التزام ثابت أو قسط
);

create type public.savings_cadence as enum ('daily', 'weekly', 'monthly');

-- ─── الملف الشخصي والإعدادات ───────────────────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- العملة تُختار في الإعداد ١. ليست د.ك دائمًا — البلايستور عالمي.
  currency_code text not null default 'KWD',
  currency_symbol text not null default 'د.ك',
  -- ٣ للدينار، ٢ لأغلب العملات، ٠ لليَن
  minor_units smallint not null default 3,

  -- جواب الإعداد ٢: «كيف تجيك فلوسك؟»
  income_shape public.income_shape not null default 'none',
  -- ١–٢٨ فقط: ٢٩–٣١ ما تنفع في فبراير
  pay_day_of_month smallint,

  locale text not null default 'ar',
  theme text not null default 'system',

  -- قواعد التنبيه. نسبة من الحد تُشعل التنبيه (0.85 = ٨٥٪)
  category_warn_at numeric(3, 2) not null default 0.85,
  alert_duplicate_subscriptions boolean not null default true,
  daily_savings_reminder_at time,
  alert_salary_day_rollover boolean not null default false,

  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_minor_units_ck check (minor_units in (0, 2, 3)),
  constraint profiles_pay_day_ck check (pay_day_of_month between 1 and 28),
  constraint profiles_warn_at_ck check (category_warn_at > 0 and category_warn_at <= 1),
  constraint profiles_theme_ck check (theme in ('light', 'dark', 'system')),
  constraint profiles_currency_ck check (currency_code ~ '^[A-Z]{3}$')
);

-- ─── الحسابات ──────────────────────────────────────────────────────

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.account_kind not null default 'cash',
  color text not null default '#6B6257',
  opening_balance bigint not null default 0,
  -- لا يُصرف منه: يُستثنى من «باقي لك هذا الشهر»
  exclude_from_spending boolean not null default false,
  -- عملة مختلفة عن الأساسية، إن وُجدت
  currency_code text,
  archived boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint accounts_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint accounts_color_ck check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint accounts_currency_ck check (currency_code is null or currency_code ~ '^[A-Z]{3}$')
);

-- ─── الفئات ────────────────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  -- مسار SVG بخط واحد (viewBox 24×24). لا إيموجي: شكله يختلف بين
  -- الأجهزة وما يقبل تلوينًا.
  icon text not null,
  -- null = «خذ المتبقي من الدخل». فئة واحدة فقط تكون null (انظر الفهرس)
  monthly_limit bigint,
  -- كلمات تساعد التصنيف في الإدخال النصي
  keywords text[] not null default '{}',
  sort_order smallint not null default 0,
  -- أرشفة لا حذف: حذف فئة فيها عمليات يخرّب التقارير القديمة
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint categories_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint categories_color_ck check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint categories_limit_ck check (monthly_limit is null or monthly_limit >= 0)
);

-- فئة «المتبقي» واحدة لكل مستخدم. القاعدة في التصميم، فنفرضها هنا
-- بدل ما نعتمد على انضباط العميل.
create unique index categories_one_remainder_per_user
  on public.categories (user_id)
  where monthly_limit is null and not archived and deleted_at is null;

-- ─── الدخل ─────────────────────────────────────────────────────────

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- null = مصدر غير منتظم. لا نبني حدودًا على مبلغ متوقَّع.
  typical_amount bigint,
  pay_day_of_month smallint,
  account_id uuid references public.accounts (id) on delete set null,
  -- المصدر الذي يبدأ عنده الشهر المالي
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint income_sources_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint income_sources_amount_ck check (typical_amount is null or typical_amount > 0),
  constraint income_sources_pay_day_ck check (pay_day_of_month between 1 and 28)
);

create unique index income_sources_one_primary_per_user
  on public.income_sources (user_id)
  where is_primary and active and deleted_at is null;

-- تعديل راتب شهر واحد. تعديل نوفمبر لا يلمس أكتوبر — هذا الجدول هو
-- السبب: الشهور السابقة صفوف مستقلة.
create table public.income_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- أول يوم من الشهر المعني. date لا text: يترتب ويُقارن صح.
  month date not null,
  actual_amount bigint not null,
  -- إضافات غير متكررة: [{"label": "مكافأة", "amount": 215000}]
  extras jsonb not null default '[]',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint income_overrides_month_ck check (date_trunc('month', month) = month),
  constraint income_overrides_amount_ck check (actual_amount >= 0),
  constraint income_overrides_extras_ck check (jsonb_typeof(extras) = 'array'),
  constraint income_overrides_unique unique (user_id, month)
);

-- ─── الالتزامات ────────────────────────────────────────────────────

create table public.fixed_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.commitment_kind not null default 'other',
  -- 0 مسموح: نعرض البند بمبلغ فاضي ويكتبه المستخدم. رقم مخترع أسوأ
  -- من خانة فاضية.
  amount bigint not null default 0,
  -- تقديري (مثل الجمعية) → لا تنبّه لو اختلف المبلغ شوي
  is_approximate boolean not null default false,
  auto_deduct boolean not null default true,
  day_of_month smallint,
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  active boolean not null default true,
  started_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint fixed_commitments_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint fixed_commitments_amount_ck check (amount >= 0),
  constraint fixed_commitments_day_ck check (day_of_month between 1 and 28)
);

-- التزام له نهاية: قسط أثاث، جهاز، دَين.
create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- الأصل كامل. null لو المستخدم يعرف المتبقي بس.
  principal bigint,
  -- الحقل الوحيد المطلوب فعلًا
  remaining bigint not null,
  -- null = المستخدم ما حدّده بعد. لا نخترع قسطًا.
  monthly_amount bigint,
  account_id uuid references public.accounts (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint installments_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint installments_remaining_ck check (remaining >= 0),
  constraint installments_principal_ck check (principal is null or principal >= remaining),
  constraint installments_monthly_ck check (monthly_amount is null or monthly_amount > 0)
);

-- مصروف موسمي/سنوي (رسوم، تأمين سيارة، سفر الصيف).
-- يُقسَّم على عدة شهور ويُحجز شهريًا حتى لا يفاجئ المستخدم.
create table public.sinking_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  total_amount bigint not null,
  due_month date not null,
  accrued bigint not null default 0,
  months_to_spread smallint not null default 12,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint sinking_funds_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint sinking_funds_total_ck check (total_amount > 0),
  constraint sinking_funds_accrued_ck check (accrued >= 0),
  constraint sinking_funds_months_ck check (months_to_spread between 1 and 120),
  constraint sinking_funds_due_ck check (date_trunc('month', due_month) = due_month)
);

-- ─── الادخار ───────────────────────────────────────────────────────

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#C2185B',
  cadence public.savings_cadence not null default 'monthly',
  -- المبلغ لكل وحدة من الـ cadence (٤١ يوميًا = 41000 مع cadence=daily)
  amount_per_period bigint not null,
  account_id uuid references public.accounts (id) on delete set null,
  target_amount bigint,
  target_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint savings_goals_name_ck check (char_length(trim(name)) between 1 and 60),
  constraint savings_goals_color_ck check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint savings_goals_amount_ck check (amount_per_period > 0),
  constraint savings_goals_target_ck check (target_amount is null or target_amount > 0)
);

create table public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  -- بدون وقت: حفظ واحد لكل يوم لكل هدف
  deposit_date date not null,
  amount bigint not null,
  -- confirmed = المستخدم أكّد، auto = خُصم تلقائيًا
  via text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint savings_deposits_amount_ck check (amount > 0),
  constraint savings_deposits_via_ck check (via in ('confirmed', 'auto')),
  constraint savings_deposits_unique unique (goal_id, deposit_date)
);

-- ─── العمليات ──────────────────────────────────────────────────────

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  occurred_at timestamptz not null default now(),
  -- دائمًا موجب. الإشارة تجي من kind، لا من المبلغ.
  amount bigint not null,
  kind public.tx_kind not null default 'expense',
  description text not null default '',

  category_id uuid references public.categories (id) on delete set null,
  account_id uuid not null references public.accounts (id) on delete restrict,
  -- للتحويل فقط
  to_account_id uuid references public.accounts (id) on delete restrict,

  source public.tx_source not null default 'manual',
  -- النص كما كتبه المستخدم — لتحسين التصنيف لاحقًا
  raw_text text,
  -- صنّفه النظام ولم يؤكّده المستخدم بعد
  needs_review boolean not null default false,
  -- لو المستخدم غيّر الفئة، نخزّن القديمة لتحسين التصنيف
  reclassified_from uuid,

  -- بصمة ضد الإدخال المزدوج بالخطأ (ضغطتان على «حفظ»)
  dedupe_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint transactions_amount_ck check (amount > 0),

  -- التحويل: حسابان مختلفان وبلا فئة. المصروف والدخل: بلا حساب ثانٍ.
  -- هذا القيد هو ما يمنع أكثر غلطة في تطبيقات الميزانية: احتساب
  -- التحويل بين حسابيك كأنه صرف.
  constraint transactions_shape_ck check (
    case kind
      when 'transfer' then to_account_id is not null
                       and to_account_id <> account_id
                       and category_id is null
      else to_account_id is null
    end
  )
);

create unique index transactions_dedupe
  on public.transactions (user_id, dedupe_key)
  where dedupe_key is not null and deleted_at is null;

-- ─── التنبيهات ─────────────────────────────────────────────────────

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  body text not null default '',
  -- الفئة/الهدف/الالتزام المعني
  subject_id uuid,
  raised_at timestamptz not null default now(),
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint alerts_severity_ck check (severity in ('info', 'warn', 'critical')),
  constraint alerts_kind_ck check (kind in (
    'category_near', 'category_over', 'duplicate_subscription',
    'savings_missed', 'sinking_due_soon', 'income_missing'
  ))
);

-- ─── الفهارس ───────────────────────────────────────────────────────
-- نمطان فقط يهمّان: سحب التغييرات للمزامنة، وقراءة شهر واحد.

create index accounts_sync_idx on public.accounts (user_id, updated_at);
create index categories_sync_idx on public.categories (user_id, updated_at);
create index income_sources_sync_idx on public.income_sources (user_id, updated_at);
create index income_overrides_sync_idx on public.income_overrides (user_id, updated_at);
create index fixed_commitments_sync_idx on public.fixed_commitments (user_id, updated_at);
create index installments_sync_idx on public.installments (user_id, updated_at);
create index sinking_funds_sync_idx on public.sinking_funds (user_id, updated_at);
create index savings_goals_sync_idx on public.savings_goals (user_id, updated_at);
create index savings_deposits_sync_idx on public.savings_deposits (user_id, updated_at);
create index transactions_sync_idx on public.transactions (user_id, updated_at);
create index alerts_sync_idx on public.alerts (user_id, updated_at);

-- شاشة العمليات وكل حساب شهري يقرأ بهذا:
create index transactions_month_idx
  on public.transactions (user_id, occurred_at desc)
  where deleted_at is null;

-- شاشة تفاصيل فئة:
create index transactions_category_idx
  on public.transactions (user_id, category_id, occurred_at desc)
  where deleted_at is null;

create index savings_deposits_goal_idx
  on public.savings_deposits (user_id, goal_id, deposit_date desc)
  where deleted_at is null;

-- الفهارس التي تحتاجها المفاتيح الأجنبية (Postgres لا يبنيها تلقائيًا،
-- وبدونها الحذف من جدول الأب يصير مسحًا كاملًا للجدول الابن):
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id);
create index transactions_category_fk_idx on public.transactions (category_id);
create index savings_deposits_goal_fk_idx on public.savings_deposits (goal_id);
create index income_sources_account_idx on public.income_sources (account_id);
create index fixed_commitments_category_idx on public.fixed_commitments (category_id);
create index fixed_commitments_account_idx on public.fixed_commitments (account_id);
create index installments_account_idx on public.installments (account_id);
create index savings_goals_account_idx on public.savings_goals (account_id);

-- ─── updated_at تلقائيًا ───────────────────────────────────────────

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger income_sources_touch before update on public.income_sources
  for each row execute function public.touch_updated_at();
create trigger income_overrides_touch before update on public.income_overrides
  for each row execute function public.touch_updated_at();
create trigger fixed_commitments_touch before update on public.fixed_commitments
  for each row execute function public.touch_updated_at();
create trigger installments_touch before update on public.installments
  for each row execute function public.touch_updated_at();
create trigger sinking_funds_touch before update on public.sinking_funds
  for each row execute function public.touch_updated_at();
create trigger savings_goals_touch before update on public.savings_goals
  for each row execute function public.touch_updated_at();
create trigger savings_deposits_touch before update on public.savings_deposits
  for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();
create trigger alerts_touch before update on public.alerts
  for each row execute function public.touch_updated_at();

-- ─── إنشاء ملف شخصي عند التسجيل ────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RLS ───────────────────────────────────────────────────────────
-- تطبيق متعدد المستخدمين على البلايستور: كل مستخدم يرى صفوفه فقط.
--
-- `(select auth.uid())` مقصود: التغليف بـ select يجعل Postgres يحسب
-- القيمة مرة واحدة (InitPlan) بدل كل صف. فرق حقيقي على جدول العمليات.

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.income_sources enable row level security;
alter table public.income_overrides enable row level security;
alter table public.fixed_commitments enable row level security;
alter table public.installments enable row level security;
alter table public.sinking_funds enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_deposits enable row level security;
alter table public.transactions enable row level security;
alter table public.alerts enable row level security;

-- profiles: مفتاحه user_id نفسه، ولا insert من العميل (التريقر يسوّيه)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- بقية الجداول: نفس الأربع سياسات. مكتوبة صريحة لكل جدول — DO block
-- أقصر لكن يخفي السياسات عن `supabase db diff` ومن يقرأ الملف.

create policy "accounts_select_own" on public.accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "accounts_insert_own" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "accounts_update_own" on public.accounts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "accounts_delete_own" on public.accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "categories_select_own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "income_sources_select_own" on public.income_sources
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "income_sources_insert_own" on public.income_sources
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "income_sources_update_own" on public.income_sources
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "income_sources_delete_own" on public.income_sources
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "income_overrides_select_own" on public.income_overrides
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "income_overrides_insert_own" on public.income_overrides
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "income_overrides_update_own" on public.income_overrides
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "income_overrides_delete_own" on public.income_overrides
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "fixed_commitments_select_own" on public.fixed_commitments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "fixed_commitments_insert_own" on public.fixed_commitments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fixed_commitments_update_own" on public.fixed_commitments
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fixed_commitments_delete_own" on public.fixed_commitments
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "installments_select_own" on public.installments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "installments_insert_own" on public.installments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "installments_update_own" on public.installments
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "installments_delete_own" on public.installments
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "sinking_funds_select_own" on public.sinking_funds
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sinking_funds_insert_own" on public.sinking_funds
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sinking_funds_update_own" on public.sinking_funds
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sinking_funds_delete_own" on public.sinking_funds
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "savings_goals_select_own" on public.savings_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "savings_goals_insert_own" on public.savings_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "savings_goals_update_own" on public.savings_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "savings_goals_delete_own" on public.savings_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "savings_deposits_select_own" on public.savings_deposits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "savings_deposits_insert_own" on public.savings_deposits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "savings_deposits_update_own" on public.savings_deposits
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "savings_deposits_delete_own" on public.savings_deposits
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions_select_own" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "alerts_select_own" on public.alerts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "alerts_insert_own" on public.alerts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "alerts_update_own" on public.alerts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "alerts_delete_own" on public.alerts
  for delete to authenticated using ((select auth.uid()) = user_id);
