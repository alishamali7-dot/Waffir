import type { NextConfig } from 'next';

/**
 * `externalDir` يسمح باستيراد ملفّات من خارج مجلّد `web/`.
 *
 * الغرض منه هنا واحد: الوحدات النقيّة في جذر المستودع — `types.ts`
 * و`budget.ts` و`quickEntry.ts` و`i18n/` — تُستعمل في تطبيق الجوّال
 * وفي الويب بنسخة واحدة. بدونه نُسخة ثانية من حساب الميزانية على
 * الويب، ونسختان من منطق المال تتباعدان بهدوء حتى يظهر رقمان مختلفان
 * للشيء نفسه.
 *
 * لا شي من هذي الوحدات يستورد React Native، ولذلك يعمل في الاثنين.
 */
const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  typedRoutes: true,
};

export default nextConfig;
