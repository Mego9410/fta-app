import type { ProfileSettings } from '@/src/domain/types';
import { getDbHandle } from '@/src/data/db';

const PROFILE_SETTINGS_KEY_V1 = 'profile.settings.v1';

const DEFAULTS: ProfileSettings = {
  pushNewListings: true,
  pushSavedActivity: true,
  marketingEmails: false,
  emailNotifications: true,
  useSearchFilters: false,
};

export async function getProfileSettings(): Promise<ProfileSettings> {
  const db = await getDbHandle();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ? LIMIT 1',
    [PROFILE_SETTINGS_KEY_V1],
  );
  if (!rows.length) return DEFAULTS;

  const raw = rows[0]?.value;
  if (typeof raw !== 'string') return DEFAULTS;
  try {
    const parsed = JSON.parse(raw);
    return sanitizeProfileSettings(parsed) ?? DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function setProfileSettings(settings: ProfileSettings): Promise<void> {
  const safe = sanitizeProfileSettings(settings) ?? DEFAULTS;
  const db = await getDbHandle();
  await db.runAsync(
    'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [PROFILE_SETTINGS_KEY_V1, JSON.stringify(safe)],
  );
}

export async function clearProfileSettings(): Promise<void> {
  const db = await getDbHandle();
  await db.runAsync('DELETE FROM meta WHERE key = ?', [PROFILE_SETTINGS_KEY_V1]);
}

function sanitizeProfileSettings(input: any): ProfileSettings | null {
  if (!input || typeof input !== 'object') return null;
  return {
    pushNewListings: !!input.pushNewListings,
    pushSavedActivity: !!input.pushSavedActivity,
    marketingEmails: !!input.marketingEmails,
    emailNotifications: input.emailNotifications !== undefined ? !!input.emailNotifications : true,
    useSearchFilters: !!input.useSearchFilters,
  };
}

