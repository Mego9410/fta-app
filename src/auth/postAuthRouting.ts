import type { SupabaseClient } from '@supabase/supabase-js';

export type OnboardingStep = 'profile' | 'buyer' | 'preferences' | 'done';

export function stepToRoute(step: string | null | undefined): string {
  const s = (step ?? 'profile') as OnboardingStep;
  if (s === 'buyer') return '/(onboarding)/buyer';
  if (s === 'preferences') return '/(onboarding)/preferences';
  if (s === 'done') return '/(onboarding)/done';
  return '/(onboarding)/profile';
}

/**
 * Returns the appropriate route after a successful sign-in for an existing user.
 * Mirrors the gate logic in `app/index.tsx`.
 */
export async function getPostSignInRoute(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, onboarding_step')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;

  if (!profile) {
    // First time this user is seen on this device (or profile row was removed).
    const { error: upsertErr } = await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: '',
        onboarding_step: 'profile',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (upsertErr) throw upsertErr;
    return '/(onboarding)/welcome';
  }

  if (profile.onboarding_completed_at) return '/(tabs)';

  const step = (profile.onboarding_step ?? 'profile') as OnboardingStep;
  if (step === 'profile') return '/(onboarding)/welcome';
  return stepToRoute(step);
}

