'use client';

import { useTransition } from 'react';

import { setLang } from '@/app/actions';
import type { Lang } from '@shared/i18n';

export function LangToggle({ lang }: { lang: Lang }) {
  const [pending, start] = useTransition();
  const next: Lang = lang === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      className="langbtn"
      disabled={pending}
      // اسم الزرّ باللغة التي سينتقل إليها، لا بالحالية: من لا يقرأ
      // العربية يجد «English» ظاهرة.
      onClick={() => start(() => void setLang(next))}
      aria-label={next === 'en' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      {next === 'en' ? 'English' : 'العربية'}
    </button>
  );
}
