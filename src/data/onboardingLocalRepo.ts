import { getMetaValue, setMetaValue } from '@/src/data/db';

export type LocalOnboardingStep = 'profile' | 'buyer' | 'preferences' | 'done';

export type LocalOnboardingState = {
  step: LocalOnboardingStep;
  completedAt: string | null;
  profile: {
    fullName: string;
    email: string;
    phone: string;
    homeLocationLabel: string;
  };
  buyer: {
    industries: string[];
    budgetMin: number | null;
    budgetMax: number | null;
    timeline: string;
  };
  preferences: {
    searchRadiusKm: number;
    pushNotificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
  };
};

const KEY = 'onboardingState_v1';
const ADMIN_SKIP_KEY = 'adminSkipOnboarding_v1';
const ADMIN_FORCE_NEXT_OPEN_KEY = 'adminForceOnboardingNextOpen_v1';

function defaultState(): LocalOnboardingState {
  return {
    step: 'profile',
    completedAt: null,
    profile: { fullName: '', email: '', phone: '', homeLocationLabel: '' },
    buyer: { industries: [], budgetMin: null, budgetMax: null, timeline: '' },
    preferences: {
      searchRadiusKm: 50,
      pushNotificationsEnabled: false,
      emailNotificationsEnabled: true,
    },
  };
}

function safeParse(json: string | null): LocalOnboardingState {
  if (!json) return defaultState();
  try {
    const parsed = JSON.parse(json);
    return {
      ...defaultState(),
      ...parsed,
      profile: { ...defaultState().profile, ...(parsed?.profile ?? {}) },
      buyer: { ...defaultState().buyer, ...(parsed?.buyer ?? {}) },
      preferences: { ...defaultState().preferences, ...(parsed?.preferences ?? {}) },
    };
  } catch {
    return defaultState();
  }
}

export async function getLocalOnboardingState(): Promise<LocalOnboardingState> {
  return safeParse(await getMetaValue(KEY));
}

export async function setLocalOnboardingState(next: LocalOnboardingState) {
  await setMetaValue(KEY, JSON.stringify(next));
}

export async function patchLocalOnboardingState(patch: Partial<LocalOnboardingState>) {
  const cur = await getLocalOnboardingState();
  const next: LocalOnboardingState = {
    ...cur,
    ...patch,
    profile: { ...cur.profile, ...(patch as any).profile },
    buyer: { ...cur.buyer, ...(patch as any).buyer },
    preferences: { ...cur.preferences, ...(patch as any).preferences },
  };
  await setLocalOnboardingState(next);
  return next;
}

export async function setLocalOnboardingStep(step: LocalOnboardingStep) {
  return await patchLocalOnboardingState({ step });
}

export async function markLocalOnboardingComplete() {
  return await patchLocalOnboardingState({ step: 'done', completedAt: new Date().toISOString() });
}

export async function isAdminSkipOnboardingEnabled(): Promise<boolean> {
  return (await getMetaValue(ADMIN_SKIP_KEY)) === 'true';
}

export async function setAdminSkipOnboardingEnabled(enabled: boolean) {
  await setMetaValue(ADMIN_SKIP_KEY, enabled ? 'true' : 'false');
}

export async function isAdminForceOnboardingNextOpenEnabled(): Promise<boolean> {
  return (await getMetaValue(ADMIN_FORCE_NEXT_OPEN_KEY)) === 'true';
}

export async function setAdminForceOnboardingNextOpenEnabled(enabled: boolean) {
  await setMetaValue(ADMIN_FORCE_NEXT_OPEN_KEY, enabled ? 'true' : 'false');
}

/**
 * One-shot flag: returns whether forcing was enabled, and clears it.
 * Useful for "force onboarding on next app open".
 */
export async function consumeAdminForceOnboardingNextOpen(): Promise<boolean> {
  const enabled = await isAdminForceOnboardingNextOpenEnabled();
  if (enabled) await setAdminForceOnboardingNextOpenEnabled(false);
  return enabled;
}

