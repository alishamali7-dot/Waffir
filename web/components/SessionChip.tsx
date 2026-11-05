import { signOut } from '@/app/actions';
import { getLocale } from '@/lib/lang';
import { isConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/** من في الجلسة. `<form action>` يعمل بلا JavaScript ولا مكوّن عميل. */
export async function SessionChip() {
  if (!isConfigured) return null;

  const { s } = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <a className="langbtn" href="/login">
        {s.auth.signIn}
      </a>
    );
  }

  return (
    <form action={signOut} className="session">
      <bdi className="session-who" dir="ltr">
        {data.user.email}
      </bdi>
      <button type="submit" className="langbtn">
        {s.auth.signOut}
      </button>
    </form>
  );
}
