/**
 * عميل السيرفر — جلسةٌ من الكوكي.
 *
 * `getAll`/`setAll` هما ما يطلبه `@supabase/ssr` ليُجدّد التوكن من
 * نفسه. والكتابة داخل `try` لأنّ مكوّن سيرفر (Server Component) لا
 * يملك تعديل الكوكي؛ التجديد يجري في `middleware.ts` حيث يُسمح به،
 * فالفشل هنا متوقَّعٌ ولا يُسقط الصفحة.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { SUPABASE_KEY, SUPABASE_URL } from './config';

export async function createClient() {
  const jar = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of list) {
            jar.set(name, value, options);
          }
        } catch {
          // مكوّن سيرفر: التجديد يتولّاه middleware.
        }
      },
    },
  });
}
