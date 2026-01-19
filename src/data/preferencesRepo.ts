import type { SearchPreferences } from '@/src/domain/types';
import { getDbHandle } from '@/src/data/db';

const SEARCH_PREFS_KEY_V1 = 'prefs.search.v1';

export async function getSearchPreferences(): Promise<SearchPreferences | null> {
  const db = await getDbHandle();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ? LIMIT 1',
    [SEARCH_PREFS_KEY_V1],
  );
  if (!rows.length) return null;

  const raw = rows[0]?.value;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return sanitizeSearchPreferences(parsed);
  } catch {
    return null;
  }
}

export async function setSearchPreferences(prefs: SearchPreferences): Promise<void> {
  const safe = sanitizeSearchPreferences(prefs);
  if (!safe) return;

  const db = await getDbHandle();
  await db.runAsync(
    'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [SEARCH_PREFS_KEY_V1, JSON.stringify(safe)],
  );
}

export async function clearSearchPreferences(): Promise<void> {
  const db = await getDbHandle();
  await db.runAsync('DELETE FROM meta WHERE key = ?', [SEARCH_PREFS_KEY_V1]);
}

function sanitizeSearchPreferences(input: any): SearchPreferences | null {
  if (!input || typeof input !== 'object') return null;

  const keyword = typeof input.keyword === 'string' ? input.keyword : '';

  const surgeriesMax = toFiniteInt(input.surgeriesMax, 10);
  const feeIncomeMax = toFiniteInt(input.feeIncomeMax, 0);
  const radiusMiles = toFiniteInt(input.radiusMiles, 25);

  const propertyTypes = toStringArray(input.propertyTypes);
  const incomeTypes = toStringArray(input.incomeTypes);
  const locationText = typeof input.locationText === 'string' ? input.locationText : '';

  return {
    keyword,
    surgeriesMax: Math.max(1, surgeriesMax),
    feeIncomeMax: Math.max(0, feeIncomeMax),
    propertyTypes,
    incomeTypes,
    locationText,
    radiusMiles: Math.max(1, radiusMiles),
  };
}

function toFiniteInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x) => typeof x === 'string');
}
