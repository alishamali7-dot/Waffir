import type { AppState } from '@shared/types';

import { SampleSource } from './sample';
import type { DataSource } from './source';

/**
 * **هنا تُضاف المصادقة، وهنا وحدها.**
 *
 * اليوم: مصدر العيّنة دائمًا، لأنّ سياسات RLS تُرجع صفر صفوف بلا
 * جلسة فيظهر التطبيق فارغًا ولا يمكن الحكم عليه.
 *
 * بعد المصادقة يصير الجسم:
 *
 *   const supa = new SupabaseSource(await createServerClient());
 *   return (await supa.hasSession()) ? supa : new SampleSource();
 *
 * ولا شاشة واحدة تتغيّر: كلّها تستدعي `loadAppState()` وتأخذ
 * `AppState`. (`SupabaseSource` مكتوب ومنتظر في `supabase-source.ts`.)
 */
export async function getSource(): Promise<DataSource> {
  return new SampleSource();
}

export async function loadAppState(): Promise<{
  state: AppState;
  isLive: boolean;
}> {
  const source = await getSource();
  return { state: await source.loadState(), isLive: source.isLive };
}
