/**
 * عميل Supabase لمُوَفِّر.
 *
 * نقطة مهمة في التصميم: التطبيق يشتغل كامل **بدون تسجيل دخول**. هذا
 * العميل يُستعمل فقط لمن يبي يزامن أجهزته أو يحفظ نسخة. لا تضع
 * `requireAuth` على أي شاشة.
 *
 * يحتاج:
 *   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
 */

import 'react-native-url-polyfill/auto'; // لازم قبل أي استيراد لـ supabase
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // لا نرمي خطأ: غياب المفاتيح يعني «بلا مزامنة»، وهذا وضع مشروع.
  console.warn('[mwaffir] مفاتيح Supabase غير موجودة — المزامنة معطّلة');
}

export const supabase =
  url && key
    ? createClient<Database>(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // على الجوال ما فيه رابط رجوع في العنوان
          detectSessionInUrl: false,
        },
      })
    : null;

export const syncEnabled = () => supabase !== null;
