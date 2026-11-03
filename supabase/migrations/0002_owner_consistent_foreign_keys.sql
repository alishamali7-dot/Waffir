-- المفاتيح الأجنبية المركّبة: تمنع ربط صفٍّ بصفِّ مستخدم آخر.
--
-- المشكلة التي يحلّها: سياسة RLS تتحقّق من `user_id` في الصف المكتوب
-- فقط. فلو كتب التطبيق عمليةً لمستخدم أ وفيها `account_id` يملكه ب،
-- قبلها Postgres: المفتاح الأجنبي البسيط يتحقّق من وجود الحساب لا من
-- مالكه.
--
-- ليست ثغرة تسريب — لا أحد يقرأ صفوف غيره، وكل الاستعلامات مفلترة
-- بـ user_id. لكنها خطر من جهة أخرى أرجح: خطأ في طبقة المزامنة يربط
-- عملية بالحساب الخطأ ولا شي في القاعدة يمنعه، فتظهر أرقام غلط ولا
-- تعرف من وين جاءت.
--
-- العلاج في القاعدة لا في كل مسار كتابة: مفتاح أجنبي على
-- (user_id, id) يجعل عدم التطابق خطأً فوريًّا.

alter table public.accounts      add constraint accounts_user_id_key      unique (user_id, id);
alter table public.categories    add constraint categories_user_id_key    unique (user_id, id);
alter table public.savings_goals add constraint savings_goals_user_id_key unique (user_id, id);

alter table public.transactions drop constraint transactions_account_id_fkey;
alter table public.transactions drop constraint transactions_to_account_id_fkey;
alter table public.transactions drop constraint transactions_category_id_fkey;

alter table public.transactions
  add constraint transactions_account_fk
  foreign key (user_id, account_id) references public.accounts (user_id, id)
  on delete restrict;

alter table public.transactions
  add constraint transactions_to_account_fk
  foreign key (user_id, to_account_id) references public.accounts (user_id, id)
  on delete restrict;

alter table public.transactions
  add constraint transactions_category_fk
  foreign key (user_id, category_id) references public.categories (user_id, id)
  on delete set null;

alter table public.savings_deposits drop constraint savings_deposits_goal_id_fkey;
alter table public.savings_deposits
  add constraint savings_deposits_goal_fk
  foreign key (user_id, goal_id) references public.savings_goals (user_id, id)
  on delete cascade;

alter table public.income_sources drop constraint income_sources_account_id_fkey;
alter table public.income_sources
  add constraint income_sources_account_fk
  foreign key (user_id, account_id) references public.accounts (user_id, id)
  on delete set null;

alter table public.fixed_commitments drop constraint fixed_commitments_account_id_fkey;
alter table public.fixed_commitments drop constraint fixed_commitments_category_id_fkey;
alter table public.fixed_commitments
  add constraint fixed_commitments_account_fk
  foreign key (user_id, account_id) references public.accounts (user_id, id)
  on delete set null;
alter table public.fixed_commitments
  add constraint fixed_commitments_category_fk
  foreign key (user_id, category_id) references public.categories (user_id, id)
  on delete set null;

alter table public.installments drop constraint installments_account_id_fkey;
alter table public.installments
  add constraint installments_account_fk
  foreign key (user_id, account_id) references public.accounts (user_id, id)
  on delete set null;

alter table public.savings_goals drop constraint savings_goals_account_id_fkey;
alter table public.savings_goals
  add constraint savings_goals_account_fk
  foreign key (user_id, account_id) references public.accounts (user_id, id)
  on delete set null;

-- الفهارس على العمود وحده لم تعد تخدم المفاتيح الجديدة: المفتاح
-- المركّب يحتاج فهرسًا يبدأ بـ user_id.
drop index if exists public.transactions_account_idx;
drop index if exists public.transactions_to_account_idx;
drop index if exists public.transactions_category_fk_idx;
drop index if exists public.savings_deposits_goal_fk_idx;
drop index if exists public.income_sources_account_idx;
drop index if exists public.fixed_commitments_category_idx;
drop index if exists public.fixed_commitments_account_idx;
drop index if exists public.installments_account_idx;
drop index if exists public.savings_goals_account_idx;

create index transactions_account_fk_idx on public.transactions (user_id, account_id);
create index transactions_to_account_fk_idx on public.transactions (user_id, to_account_id);
create index transactions_category_fk_idx on public.transactions (user_id, category_id);
create index savings_deposits_goal_fk_idx on public.savings_deposits (user_id, goal_id);
create index income_sources_account_fk_idx on public.income_sources (user_id, account_id);
create index fixed_commitments_account_fk_idx on public.fixed_commitments (user_id, account_id);
create index fixed_commitments_category_fk_idx on public.fixed_commitments (user_id, category_id);
create index installments_account_fk_idx on public.installments (user_id, account_id);
create index savings_goals_account_fk_idx on public.savings_goals (user_id, account_id);
