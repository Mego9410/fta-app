import { getDbHandle, getMetaValue, setMetaValue } from '@/src/data/db';
import { parseFtaPracticesForSaleHtml, FTA_PRACTICES_FOR_SALE_URL } from '@/src/data/importers/ftaPracticesForSale';
import { upsertListing } from '@/src/data/listingsRepo';

type SyncStatus = 'never' | 'ok' | 'skipped' | 'error';

const META_LAST_AT = 'listingsSync.lastAt.v1';
const META_LAST_STATUS = 'listingsSync.lastStatus.v1';
const META_LAST_COUNT = 'listingsSync.lastCount.v1';
const META_LAST_ERROR = 'listingsSync.lastError.v1';

export type ListingsSyncMeta = {
  status: SyncStatus;
  lastAt: string | null;
  lastCount: number | null;
  lastError: string | null;
};

export async function getListingsSyncMeta(): Promise<ListingsSyncMeta> {
  const [lastAt, status, lastCountRaw, lastError] = await Promise.all([
    getMetaValue(META_LAST_AT),
    getMetaValue(META_LAST_STATUS),
    getMetaValue(META_LAST_COUNT),
    getMetaValue(META_LAST_ERROR),
  ]);

  const lastAtNorm = lastAt && lastAt.trim().length ? lastAt : null;
  const statusNorm = status && status.trim().length ? status : null;
  const lastCountNorm = lastCountRaw && lastCountRaw.trim().length ? lastCountRaw : null;
  const lastErrorNorm = lastError && lastError.trim().length ? lastError : null;

  return {
    status: statusNorm === 'ok' || statusNorm === 'skipped' || statusNorm === 'error' ? statusNorm : 'never',
    lastAt: lastAtNorm,
    lastCount: lastCountNorm == null ? null : Number(lastCountNorm),
    lastError: lastErrorNorm,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function msSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

async function setMetaStatus(patch: Partial<Omit<ListingsSyncMeta, 'lastCount' | 'status'>> & { status?: SyncStatus; lastCount?: number | null }) {
  const ops: Promise<void>[] = [];
  if (patch.status) ops.push(setMetaValue(META_LAST_STATUS, patch.status));
  if (patch.lastAt !== undefined) ops.push(setMetaValue(META_LAST_AT, patch.lastAt ?? ''));
  if (patch.lastCount !== undefined) ops.push(setMetaValue(META_LAST_COUNT, patch.lastCount == null ? '' : String(patch.lastCount)));
  if (patch.lastError !== undefined) ops.push(setMetaValue(META_LAST_ERROR, patch.lastError ?? ''));
  await Promise.all(ops);
}

export type SyncListingsOptions = {
  force?: boolean;
  /**
   * Skip sync if the last successful sync was recent.
   * Defaults to 12 hours.
   */
  throttleMs?: number;
};

/**
 * Syncs listings from the FTA website into local SQLite.
 * - Upserts current listings from the website.
 * - Deletes `ftaweb-*` listings that disappeared from the website.
 * - Persists last sync metadata in `meta`.
 */
export async function maybeSyncListingsFromWebsite(options: SyncListingsOptions = {}) {
  const force = options.force ?? false;
  const throttleMs = options.throttleMs ?? 12 * 60 * 60 * 1000;

  const meta = await getListingsSyncMeta();
  const ageMs = msSince(meta.lastAt);
  if (!force && meta.status === 'ok' && ageMs != null && ageMs < throttleMs) {
    return { status: 'skipped' as const, reason: 'throttled' as const };
  }

  try {
    const res = await fetch(FTA_PRACTICES_FOR_SALE_URL);
    const html = await res.text();
    const parsed = parseFtaPracticesForSaleHtml(html);

    // If the parser breaks (site changes), parsed can become empty. Treat that as a failure and keep cached listings.
    if (!parsed.length) {
      await setMetaStatus({
        status: 'error',
        lastAt: nowIso(),
        lastCount: 0,
        lastError: 'Parsed 0 listings (site markup may have changed). Keeping cached listings.',
      });
      return { status: 'error' as const, reason: 'parsed_empty' as const };
    }

    const nextIds = new Set(parsed.map((l) => l.id));

    // Upsert new/current listings.
    for (const l of parsed) {
      await upsertListing({
        ...l,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      });
    }

    // Delete missing listings (only the website-imported ones).
    const db = await getDbHandle();
    const existing = await db.getAllAsync<{ id: string }>(`SELECT id FROM listings WHERE id LIKE 'ftaweb-%'`);
    for (const row of existing) {
      if (!nextIds.has(row.id)) {
        await db.runAsync('DELETE FROM listings WHERE id = ?', [row.id]);
      }
    }

    await setMetaStatus({
      status: 'ok',
      lastAt: nowIso(),
      lastCount: parsed.length,
      lastError: null,
    });

    return { status: 'ok' as const, imported: parsed.length };
  } catch (e: any) {
    await setMetaStatus({
      status: 'error',
      lastAt: nowIso(),
      lastError: e?.message ?? String(e),
    });
    return { status: 'error' as const, reason: 'exception' as const };
  }
}

