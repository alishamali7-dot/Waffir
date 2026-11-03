'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * عميل لأنّ `aria-current` يحتاج المسار الحاليّ.
 *
 * و`aria-current="page"` لا لونٌ وحده: قارئ الشاشة يعلن «الصفحة
 * الحالية»، واللون يخدم من يرى فقط.
 */
export function NavLink({
  href,
  children,
}: {
  // `Route` لا `string`: مع typedRoutes يرفض المترجمُ رابطًا لصفحة
  // غير موجودة، فينكشف الرابط المكسور وقت البناء لا عند المستخدم.
  href: Route;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = href === '/' ? path === '/' : path.startsWith(href);

  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  );
}
