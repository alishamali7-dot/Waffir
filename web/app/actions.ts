'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { LANG_COOKIE, getLang } from '@/lib/lang';
import { createClient } from '@/lib/supabase/server';
import { buildExpenseRow, type ExpenseInput } from '@shared/expense';
import { strings } from '@shared/i18n';
import { foldArabic, keywordFrom } from '@shared/quickEntry';
import { buildSeed, parseIncomeInput } from '@shared/seedPayload';
import { CURRENCIES, SITUATIONS, seedState } from '@shared/templates';
import type { IncomeShape } from '@shared/types';

/**
 * تبديل اللغة.
 *
 * Server Action لا رابط `?lang=en`: الرابط يجعل اللغة جزءًا من كلّ
 * عنوان فتُفقد عند أيّ تنقّل، والكوكي يبقى. ومع `revalidatePath`
 * يُعاد رسم الصفحة بالاتجاه الجديد في طلب واحد.
 */
export async function setLang(lang: 'ar' | 'en'): Promise<void> {
  const jar = await cookies();
  jar.set(LANG_COOKIE, lang, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

/**
 * تسجيل الخروج.
 *
 * Server Action لا نداءٌ من المتصفّح: الكوكي يُمحى على السيرفر حيث
 * كُتب، ثمّ `revalidatePath` يُسقط صفحاتَ السيرفر المحفوظة — بدونه
 * يبقى اسم المستخدم وبياناته معروضَين بعد خروجه.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * إنهاء الإعداد الأوّل.
 *
 * كلّ ما يصل هنا من المتصفّح يُفحص من جديد: Server Action نقطة دخولٍ
 * عامّة، وفحص الواجهة تجربةٌ لا حماية. والكتابة في `seed_account` معاملةً
 * واحدة، فلا فشل يترك حسابًا نصف مبذور، والضغطة الثانية لا تبذره مرّتين.
 */
export async function finishSetup(input: {
  currency: string;
  shape: IncomeShape;
  income: string;
  payDay: number;
}): Promise<{ error: 'income' | 'save' } | void> {
  const income = parseIncomeInput(String(input.income ?? ''));
  if (income === null) return { error: 'income' };

  const currency = CURRENCIES.find((c) => c.code === input.currency);
  const shapeKnown = SITUATIONS.some((s) => s.shape === input.shape);
  const dayValid = Number.isInteger(input.payDay) && input.payDay >= 1 && input.payDay <= 28;
  if (!currency || !shapeKnown || !dayValid) return { error: 'save' };

  const lang = await getLang();
  const seed = buildSeed(
    seedState(input.shape, income, currency.code, input.payDay),
    strings(lang).seed,
    lang,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc('seed_account', { seed });
  if (error) {
    console.error('seed_account:', error.message);
    return { error: 'save' };
  }

  // false = مبذورٌ من قبل (تبويبٌ آخر مثلًا): الوجهة نفسها.
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * تسجيل مصروف.
 *
 * العملة من ملفّ المستخدم لا من المتصفّح، والحساب والفئة تحرسهما RLS
 * والمفاتيح المركّبة: معرّفٌ لمستخدمٍ آخر لا يُكتب.
 *
 * الضغطة الثانية تصطدم بفهرس البصمة (23505) فتُعدّ نجاحًا: العملية سُجّلت.
 */
export async function addExpense(
  input: ExpenseInput & { learnFrom?: string },
): Promise<{ ok: true } | { error: 'amount' | 'date' | 'save' }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'save' };

  const { data: profile } = await supabase.from('profiles').select('currency_code').maybeSingle();
  if (!profile) return { error: 'save' };

  const built = buildExpenseRow(
    input,
    String(profile.currency_code),
    new Date().toISOString().slice(0, 10),
  );
  if ('error' in built) return { error: built.error ?? 'save' };

  const { error } = await supabase
    .from('transactions')
    .insert({ ...built.row, user_id: auth.user.id });

  if (error && error.code !== '23505') {
    console.error('addExpense:', error.message);
    return { error: 'save' };
  }

  if (!error && input.learnFrom) {
    await learnKeyword(built.row.category_id, String(input.learnFrom));
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * التعلّم: الفئة التي لم تأتِ من كلمةٍ مسجّلة تكسب كلمتها، فلا يُسأل النموذج
 * عنها مرّة ثانية. وفشله لا يمسّ العملية المحفوظة، فلا يُبلَّغ به المستخدم.
 */
async function learnKeyword(categoryId: string, label: string): Promise<void> {
  const keyword = keywordFrom(label);
  if (!keyword) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from('categories')
    .select('keywords')
    .eq('id', categoryId)
    .maybeSingle();
  if (!data) return;

  const keywords = (data.keywords as string[]) ?? [];
  if (keywords.some((k) => foldArabic(k) === keyword)) return;

  const { error } = await supabase
    .from('categories')
    .update({ keywords: [...keywords, keyword] })
    .eq('id', categoryId);
  if (error) console.error('learnKeyword:', error.message);
}
