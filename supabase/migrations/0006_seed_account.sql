-- بذر حسابٍ جديد في معاملةٍ واحدة.
--
-- الإعداد يكتب في خمسة جداول، والحسابات قبل ما يُشير إليها. لو كُتبت
-- بنداءاتٍ متتالية من التطبيق فانقطع الاتصال في منتصفها، بقي حسابٌ نصف
-- مبذور لا يعود إلى الإعداد ولا يعمل. فالكتابة هنا: كلّها أو لا شيء.
--
-- security invoker عن قصد: الدالّة تعمل بصلاحيّات المستخدم نفسه، فسياسات
-- RLS تحرس كلّ سطر كما لو كتبه مباشرة، ولا تحتاج ثقةً بما في الحمولة.
-- و user_id من auth.uid() دائمًا، لا من الحمولة.
--
-- تُرجع false إن كان الحساب مبذورًا: ضغطةٌ ثانية، أو تبويبٌ آخر، أو جهازٌ
-- آخر. قفل صفّ profiles يجعل المتزامنَين يتتابعان، فلا يبذر كلاهما.

create or replace function public.seed_account(seed jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'seed_account requires a session' using errcode = '42501';
  end if;

  perform 1 from public.profiles where user_id = uid for update;
  if not found then
    raise exception 'profile missing for user' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.accounts where user_id = uid and deleted_at is null)
     or exists (select 1 from public.categories where user_id = uid and deleted_at is null) then
    return false;
  end if;

  update public.profiles p set
    currency_code = seed #>> '{profile,currency_code}',
    currency_symbol = seed #>> '{profile,currency_symbol}',
    minor_units = (seed #>> '{profile,minor_units}')::smallint,
    income_shape = (seed #>> '{profile,income_shape}')::public.income_shape,
    pay_day_of_month = (seed #>> '{profile,pay_day_of_month}')::smallint,
    alert_salary_day_rollover = (seed #>> '{profile,alert_salary_day_rollover}')::boolean,
    locale = seed #>> '{profile,locale}'
  where p.user_id = uid;

  insert into public.accounts (id, user_id, name, kind, color, exclude_from_spending, sort_order)
  select r.id, uid, r.name, r.kind, r.color, r.exclude_from_spending, r.sort_order
  from jsonb_to_recordset(seed -> 'accounts') as r(
    id uuid, name text, kind public.account_kind, color text,
    exclude_from_spending boolean, sort_order smallint
  );

  insert into public.categories (id, user_id, name, color, icon, monthly_limit, keywords, sort_order)
  select r.id, uid, r.name, r.color, r.icon, r.monthly_limit, r.keywords, r.sort_order
  from jsonb_to_recordset(seed -> 'categories') as r(
    id uuid, name text, color text, icon text, monthly_limit bigint,
    keywords text[], sort_order smallint
  );

  insert into public.income_sources (id, user_id, name, typical_amount, pay_day_of_month, account_id, is_primary)
  select r.id, uid, r.name, r.typical_amount, r.pay_day_of_month, r.account_id, r.is_primary
  from jsonb_to_recordset(seed -> 'income_sources') as r(
    id uuid, name text, typical_amount bigint, pay_day_of_month smallint,
    account_id uuid, is_primary boolean
  );

  insert into public.fixed_commitments (id, user_id, name, kind, amount, is_approximate, auto_deduct)
  select r.id, uid, r.name, r.kind, r.amount, r.is_approximate, r.auto_deduct
  from jsonb_to_recordset(seed -> 'commitments') as r(
    id uuid, name text, kind public.commitment_kind, amount bigint,
    is_approximate boolean, auto_deduct boolean
  );

  insert into public.savings_goals (id, user_id, name, color, cadence, amount_per_period, account_id, target_amount)
  select r.id, uid, r.name, r.color, r.cadence, r.amount_per_period, r.account_id, r.target_amount
  from jsonb_to_recordset(seed -> 'goals') as r(
    id uuid, name text, color text, cadence public.savings_cadence,
    amount_per_period bigint, account_id uuid, target_amount bigint
  );

  return true;
end;
$$;

revoke all on function public.seed_account(jsonb) from public, anon;
grant execute on function public.seed_account(jsonb) to authenticated;
