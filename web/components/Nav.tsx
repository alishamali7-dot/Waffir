import { getLocale } from '@/lib/lang';
import { NavLink } from './NavLink';

export async function Nav() {
  const { s } = await getLocale();

  const items = [
    { href: '/', label: s.nav.home },
    { href: '/transactions', label: s.nav.transactions },
    { href: '/budget', label: s.nav.budget },
    { href: '/add', label: s.nav.add },
  ] as const;

  return (
    <nav className="nav" aria-label={s.nav.home}>
      {items.map((it) => (
        <NavLink key={it.href} href={it.href}>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
