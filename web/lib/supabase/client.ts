/**
 * عميل المتصفّح.
 *
 * المفتاح هنا عامٌّ بطبعه (publishable) ويُشحن في حزمة المتصفّح —
 * وحده لا يفتح شيئًا: سياسات RLS هي ما يحرس الصفوف. أمّا مفتاح
 * service_role فلا يدخل هذا المجلّد أبدًا.
 */

import { createBrowserClient } from '@supabase/ssr';

import { SUPABASE_KEY, SUPABASE_URL } from './config';

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
