import { requireSupabase } from '@/src/supabase/client';

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  home_location_label: string | null;
  onboarding_completed_at: string | null;
  onboarding_step: string;
  created_at?: string;
  updated_at?: string;
};

export type BuyerProfileRow = {
  user_id: string;
  industries: string[];
  budget_min: number | null;
  budget_max: number | null;
  timeline: string | null;
  updated_at?: string;
};

export type UserPreferencesRow = {
  user_id: string;
  search_radius_km: number;
  push_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  updated_at?: string;
};

export async function ensureProfile(userId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      full_name: '',
      onboarding_step: 'profile',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, home_location_label, onboarding_completed_at, onboarding_step, created_at, updated_at',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function updateProfile(userId: string, patch: Partial<Omit<ProfileRow, 'id'>>) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function getBuyerProfile(userId: string): Promise<BuyerProfileRow | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('buyer_profiles')
    .select('user_id, industries, budget_min, budget_max, timeline, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function upsertBuyerProfile(userId: string, patch: Partial<Omit<BuyerProfileRow, 'user_id'>>) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('buyer_profiles').upsert(
    {
      user_id: userId,
      industries: [],
      budget_min: null,
      budget_max: null,
      timeline: null,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function getUserPreferences(userId: string): Promise<UserPreferencesRow | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id, search_radius_km, push_notifications_enabled, email_notifications_enabled, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function upsertUserPreferences(
  userId: string,
  patch: Partial<Omit<UserPreferencesRow, 'user_id'>>,
) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      search_radius_km: 50,
      push_notifications_enabled: false,
      email_notifications_enabled: true,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function setOnboardingStep(userId: string, step: string) {
  await updateProfile(userId, { onboarding_step: step });
}

export async function markOnboardingComplete(userId: string) {
  const nowIso = new Date().toISOString();
  await updateProfile(userId, { onboarding_step: 'done', onboarding_completed_at: nowIso });
}

