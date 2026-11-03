import { cookies } from 'next/headers';

import { isRTL, strings, type Lang } from '@shared/i18n';

export const LANG_COOKIE = 'waffir_lang';

/**
 * لغة الواجهة من الكوكي.
 *
 * الكوكي لا الرابط: اللغة تُقرأ على السيرفر قبل أوّل رسم، فلا يظهر
 * السطر بالاتجاه الخطأ ثم ينقلب. والافتراضيّ عربيّ لأنّ المستخدم
 * الأوّل كويتيّ، ويتغيّر بزرّ واحد.
 */
export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return jar.get(LANG_COOKIE)?.value === 'en' ? 'en' : 'ar';
}

export async function getLocale() {
  const lang = await getLang();
  return { lang, s: strings(lang), rtl: isRTL(lang), dir: isRTL(lang) ? 'rtl' : 'ltr' } as const;
}
