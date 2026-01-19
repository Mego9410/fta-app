import { getDbHandle } from '@/src/data/db';
import type { Listing } from '@/src/domain/types';
import { getListingById } from '@/src/data/listingsRepo';

export async function isFavorite(listingId: string): Promise<boolean> {
  const db = await getDbHandle();
  const rows = await db.getAllAsync('SELECT listingId FROM favorites WHERE listingId = ? LIMIT 1', [
    listingId,
  ]);
  return rows.length > 0;
}

export async function toggleFavorite(listingId: string): Promise<boolean> {
  const db = await getDbHandle();
  const already = await isFavorite(listingId);
  if (already) {
    await db.runAsync('DELETE FROM favorites WHERE listingId = ?', [listingId]);
    return false;
  }
  await db.runAsync('INSERT OR IGNORE INTO favorites(listingId, createdAt) VALUES(?, ?)', [
    listingId,
    new Date().toISOString(),
  ]);
  return true;
}

export async function listFavoriteIds(): Promise<string[]> {
  const db = await getDbHandle();
  const rows = await db.getAllAsync<{ listingId: string }>(
    'SELECT listingId FROM favorites ORDER BY createdAt DESC',
  );
  return rows.map((r) => r.listingId);
}

export async function listFavoriteListings(): Promise<Listing[]> {
  const ids = await listFavoriteIds();
  const listings: Listing[] = [];
  for (const id of ids) {
    const listing = await getListingById(id);
    if (listing && listing.status === 'active') listings.push(listing);
  }
  return listings;
}

