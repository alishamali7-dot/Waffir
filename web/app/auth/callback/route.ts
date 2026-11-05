import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * مَهبط رابط تأكيد البريد.
 *
 * `@supabase/ssr` يعمل بتدفّق PKCE، فالرابط يعود بـ`?code=` ولا جلسة
 * قبل استبداله. والفشل ليس كارثة: فتحُ الرابط من جهازٍ غير الذي سُجّل
 * منه يُفقد المُحقِّق فيتعذّر الاستبدال، لكنّ البريد تأكّد فعلًا —
 * فيكفي أن يسجّل المستخدم دخوله.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.redirect(new URL('/login', request.url));
}
