import { redirect } from 'next/navigation';

import { SetupFlow } from '@/components/SetupFlow';
import { getSource } from '@/lib/data';
import { getLocale } from '@/lib/lang';
import { isEmptyAccount } from '@shared/seedPayload';

import '../login/auth.css';
import './setup.css';

/**
 * الإعداد الأوّل.
 *
 * لا زائرَ هنا (لا حساب يُبذر)، ولا مبذورَ (لا يُعاد إعداده). والحكم نفسه
 * الذي تستعمله `loadAppState` لإرسال الحساب الجديد إلى هنا، فلا يقع
 * الطرفان في حلقة تحويل.
 *
 * يستعمل أنماط صفحة الدخول كما هي — البطاقة والخلفيّة والأزرار — فالانتقال
 * من الدخول إلى الإعداد خطوةٌ في المسار نفسه لا تطبيقٌ آخر.
 */
export default async function SetupPage() {
  const { s, lang } = await getLocale();

  const source = await getSource();
  if (!source.isLive) redirect('/login');
  if (!isEmptyAccount(await source.loadState())) redirect('/');

  return (
    <div className="auth-page">
      <div className="auth-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <SetupFlow s={s.setup} common={s.common} lang={lang} />
    </div>
  );
}
