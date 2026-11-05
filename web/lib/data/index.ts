import { redirect } from 'next/navigation';

import { isEmptyAccount } from '@shared/seedPayload';
import type { AppState } from '@shared/types';

import { isConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { SampleSource } from './sample';
import type { DataSource } from './source';
import { SupabaseSource } from './supabase-source';

/**
 * **هنا يُختار المصدر، وهنا وحده.**
 *
 * بجلسةٍ: بيانات المستخدم من Supabase. بلا جلسة: عيّنة، لأنّ سياسات
 * RLS تُرجع صفر صفوف فيظهر التطبيق فارغًا ولا يُحكم عليه.
 *
 * ولا شاشة واحدة تتغيّر: كلّها تستدعي `loadAppState()` وتأخذ `AppState`.
 */
export async function getSource(): Promise<DataSource> {
  if (!isConfigured) return new SampleSource();
  const supa = new SupabaseSource(await createClient());
  return (await supa.hasSession()) ? supa : new SampleSource();
}

export async function loadAppState(): Promise<{
  state: AppState;
  isLive: boolean;
}> {
  const source = await getSource();
  const state = await source.loadState();

  // موضعٌ واحد تمرّ به كلّ الشاشات: حسابٌ بلا إعداد لا يرى لوحةً فارغة.
  if (source.isLive && isEmptyAccount(state)) redirect('/setup');

  return { state, isLive: source.isLive };
}
