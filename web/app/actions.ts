'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { LANG_COOKIE } from '@/lib/lang';

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
