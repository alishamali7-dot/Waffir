/**
 * تجديد الجلسة على كلّ طلب.
 *
 * توكن الوصول قصير العمر، ولا يُجدّده إلّا من يملك كتابة الكوكي —
 * وهذا الوسيط وحده. بدونه تنتهي الجلسة بعد ساعة فيُخرَج المستخدم
 * من نفسه.
 *
 * ولا حِمى على المسارات هنا عن قصد: التطبيق يعرض بيانات عيّنة بلا
 * جلسة (انظر `lib/data/index.ts`)، فالصفحات تُفتح للزائر ويُخبره
 * `SampleNotice` أنّ ما يراه ليس له.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_KEY, SUPABASE_URL, isConfigured } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser لا getSession: الأولى تتحقّق من التوكن عند Supabase،
  // والثانية تثق بالكوكي كما هو.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // كلّ شيء إلا ملفّات Next الساكنة والصور: لا جلسة تُجدَّد لأيقونة.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
