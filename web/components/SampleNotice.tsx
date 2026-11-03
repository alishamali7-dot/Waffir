import { getLocale } from '@/lib/lang';

/**
 * تنبيه صريح أنّ البيانات ليست حقيقية.
 *
 * بدونه يفتح المستخدم التطبيق فيرى مبالغ ليست له ويظنّها بياناته —
 * وهذا أسوأ من شاشة فارغة. يختفي وحده متى صار المصدر حقيقيًّا.
 */
export async function SampleNotice({ isLive }: { isLive: boolean }) {
  if (isLive) return null;
  const { lang } = await getLocale();

  return (
    <div className="notice" role="status" style={{ marginBottom: 18 }}>
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        style={{ flex: '0 0 auto', marginTop: 1 }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.6v.1" />
      </svg>
      <span>
        {lang === 'ar'
          ? 'بيانات عيّنة — لتقييم الواجهة. تصير بياناتك الحقيقية بعد إضافة تسجيل الدخول.'
          : 'Sample data, so the interface can be judged. It becomes your own once sign-in is added.'}
      </span>
    </div>
  );
}
