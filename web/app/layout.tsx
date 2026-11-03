import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';

import { LangToggle } from '@/components/LangToggle';
import { Nav } from '@/components/Nav';
import { getLocale } from '@/lib/lang';

import './globals.css';

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ar',
  display: 'swap',
});

const latin = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-en',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مُوَفِّر · Waffir',
  description: 'ميزانية شخصية بالعربية والإنجليزية · A bilingual personal budget',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { lang, s, dir } = await getLocale();

  return (
    // الاتجاه على <html> لا على عنصر داخليّ: خوارزمية bidi تحتاج
    // اتجاه الجذر، ومعه تنقلب كلّ الخصائص المنطقية (padding-inline
    // وغيرها) وحدها، فلا نحتاج ورقة أنماط ثانية للعربية.
    <html lang={lang} dir={dir} className={`${arabic.variable} ${latin.variable}`}>
      <body
        style={{
          fontFamily:
            lang === 'ar'
              ? 'var(--font-ar), system-ui, sans-serif'
              : 'var(--font-en), system-ui, sans-serif',
        }}
      >
        <header className="topbar">
          <a className="brand" href="/">
            {s.app.name}
          </a>
          <LangToggle lang={lang} />
        </header>
        <Nav />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
