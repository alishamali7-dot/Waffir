/**
 * مفاتيح Supabase ومواضع قراءتها.
 *
 * الجوّال يقرأ `EXPO_PUBLIC_*` والويب يقرأ `NEXT_PUBLIC_*`، والقيمة
 * واحدة. فنقبل الاسمين حتّى لا يُنسخ المفتاح في ملفّين ويختلفا.
 *
 * ونكشف `isConfigured` بدل أن نرمي خطأً عند الاستيراد: بلا مفاتيح
 * تُعرض رسالةٌ مفهومة في الصفحة، لا شاشةُ خطأ من Next.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

export const isConfigured = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;
