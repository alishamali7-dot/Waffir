import { redirect } from 'next/navigation';

import { AuthForm } from '@/components/AuthForm';
import { getLocale } from '@/lib/lang';
import { isConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import './auth.css';

/**
 * صفحة الدخول.
 *
 * الحراسة هنا لا في middleware: من له جلسةٌ لا شأن له بهذه الصفحة،
 * فيُحوَّل. وبقيّة الصفحات تُفتح للزائر عن قصد (بيانات عيّنة)، فلا
 * داعي لحِمًى يلفّ التطبيق كلّه.
 *
 * والخلفيّة المتحرّكة ثلاث بُقعٍ مموّهة تنساق ببطء. تتحرّك بـtransform
 * وحدها — لا عرضًا ولا موضعًا — فتبقى على الـGPU ولا تُجبر المتصفّح
 * على إعادة التخطيط ستّين مرّة في الثانية.
 */
export default async function LoginPage() {
  const { s } = await getLocale();

  // بلا مفاتيح لا عميل: نعرض النموذج ورسالته بدل انفجارٍ عند الاستيراد.
  if (isConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect('/');
  }

  return (
    <div className="auth-page">
      <div className="auth-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <AuthForm s={s.auth} configured={isConfigured} />
    </div>
  );
}
