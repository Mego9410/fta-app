import { getDbHandle } from '@/src/data/db';

type CachedJsonEnvelopeV1 = {
  fetchedAt: number; // epoch ms
  data: unknown;
};

export async function getCachedJson<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const db = await getDbHandle();
  const rows = await db.getAllAsync<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1', [key]);
  if (!rows.length) return null;
  const raw = rows[0]?.value;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as CachedJsonEnvelopeV1;
    if (!parsed || typeof parsed !== 'object') return null;
    const fetchedAt = typeof (parsed as any).fetchedAt === 'number' ? (parsed as any).fetchedAt : 0;
    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return null;
    if (Date.now() - fetchedAt > maxAgeMs) return null;
    return (parsed as any).data as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, data: unknown): Promise<void> {
  const db = await getDbHandle();
  const env: CachedJsonEnvelopeV1 = { fetchedAt: Date.now(), data };
  await db.runAsync(
    'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, JSON.stringify(env)],
  );
}

