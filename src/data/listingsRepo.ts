import type { Listing, ListingStatus } from '@/src/domain/types';
import { getDbHandle } from '@/src/data/db';
import { listListingsFromSupabase, getListingByIdFromSupabase } from '@/src/data/listingsSupabaseRepo';

type ListingsQuery = {
  status?: ListingStatus;
  featuredOnly?: boolean;
  keyword?: string;
  industry?: string;
  locationState?: string;
  minPrice?: number;
  maxPrice?: number;
  confidentialOnly?: boolean;
  financingOnly?: boolean;
};

function rowToListing(row: any): Listing {
  return {
    id: row.id,
    status: row.status,
    featured: !!row.featured,
    tags: safeParseJsonArray(row.tagsJson),
    moreInfoUrl: row.moreInfoUrl ?? null,
    title: row.title,
    industry: row.industry,
    summary: row.summary,
    locationCity: row.locationCity,
    locationState: row.locationState,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    askingPrice: Number(row.askingPrice),
    grossRevenue: row.grossRevenue == null ? null : Number(row.grossRevenue),
    cashFlow: row.cashFlow == null ? null : Number(row.cashFlow),
    ebitda: row.ebitda == null ? null : Number(row.ebitda),
    yearEstablished: row.yearEstablished == null ? null : Number(row.yearEstablished),
    employeesRange: row.employeesRange ?? null,
    freeholdValue: row.freeholdValue == null ? null : Number(row.freeholdValue),
    reconstitutedProfit: row.reconstitutedProfit == null ? null : Number(row.reconstitutedProfit),
    reconstitutedProfitPercent: row.reconstitutedProfitPercent == null ? null : Number(row.reconstitutedProfitPercent),
    udasCount: row.udasCount == null ? null : Number(row.udasCount),
    udasPricePerUda: row.udasPricePerUda == null ? null : Number(row.udasPricePerUda),
    companyType: row.companyType ?? null,
    detailedInformationText: row.detailedInformationText ?? null,
    confidential: !!row.confidential,
    financingAvailable: !!row.financingAvailable,
    photos: safeParseJsonArray(row.photosJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function safeParseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * List listings, preferring Supabase but falling back to local SQLite.
 */
export async function listListings(query: ListingsQuery = {}): Promise<Listing[]> {
  // Try Supabase first - use it if available, even if empty (indicates no listings match)
  try {
    const supabaseListings = await listListingsFromSupabase(query);
    // Return Supabase results (even if empty) to ensure we're using Supabase data
    // Only fallback to SQLite if Supabase throws an error
    return supabaseListings;
  } catch (e) {
    // Fall through to SQLite fallback only on actual errors
    console.debug('Supabase fetch failed, falling back to SQLite:', e);
  }

  // Fallback to SQLite only if Supabase throws an error
  const db = await getDbHandle();

  const where: string[] = [];
  const args: any[] = [];

  if (query.status) {
    where.push('status = ?');
    args.push(query.status);
  }
  if (query.featuredOnly) {
    where.push('featured = 1');
  }
  if (query.industry) {
    where.push('industry = ?');
    args.push(query.industry);
  }
  if (query.locationState) {
    where.push('locationState = ?');
    args.push(query.locationState);
  }
  if (query.minPrice != null) {
    where.push('askingPrice >= ?');
    args.push(query.minPrice);
  }
  if (query.maxPrice != null) {
    where.push('askingPrice <= ?');
    args.push(query.maxPrice);
  }
  if (query.confidentialOnly) {
    where.push('confidential = 1');
  }
  if (query.financingOnly) {
    where.push('financingAvailable = 1');
  }
  if (query.keyword) {
    const kw = `%${query.keyword.trim()}%`;
    if (kw !== '%%') {
      where.push('(title LIKE ? OR industry LIKE ? OR summary LIKE ? OR locationCity LIKE ? OR locationState LIKE ?)');
      args.push(kw, kw, kw, kw, kw);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.getAllAsync(
    `SELECT * FROM listings ${whereSql} ORDER BY featured DESC, updatedAt DESC`,
    args,
  );
  return rows.map(rowToListing);
}

/**
 * Get a listing by ID, preferring Supabase but falling back to local SQLite.
 */
export async function getListingById(id: string): Promise<Listing | null> {
  // Try Supabase first - return null if not found (don't fallback unless error)
  try {
    const supabaseListing = await getListingByIdFromSupabase(id);
    // Return Supabase result (even if null) to ensure we're using Supabase data
    // Only fallback to SQLite if Supabase throws an error
    return supabaseListing;
  } catch (e) {
    // Fall through to SQLite fallback only on actual errors
    console.debug('Supabase fetch failed, falling back to SQLite:', e);
  }

  // Fallback to SQLite only if Supabase throws an error
  const db = await getDbHandle();
  const rows = await db.getAllAsync('SELECT * FROM listings WHERE id = ? LIMIT 1', [id]);
  return rows.length ? rowToListing(rows[0]) : null;
}

export type CreateListingInput = Omit<Listing, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

export async function upsertListing(input: CreateListingInput): Promise<void> {
  const db = await getDbHandle();
  const nowIso = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO listings(
      id, status, featured,
      tagsJson,
      moreInfoUrl,
      title, industry, summary,
      locationCity, locationState,
      latitude, longitude,
      askingPrice, grossRevenue, cashFlow, ebitda,
      yearEstablished, employeesRange,
      freeholdValue, reconstitutedProfit, reconstitutedProfitPercent, udasCount, udasPricePerUda, companyType, detailedInformationText,
      confidential, financingAvailable,
      photosJson,
      createdAt, updatedAt
    ) VALUES(
      ?, ?, ?,
      ?,
      ?,
      ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status,
      featured=excluded.featured,
      tagsJson=excluded.tagsJson,
      moreInfoUrl=excluded.moreInfoUrl,
      title=excluded.title,
      industry=excluded.industry,
      summary=excluded.summary,
      locationCity=excluded.locationCity,
      locationState=excluded.locationState,
      latitude=excluded.latitude,
      longitude=excluded.longitude,
      askingPrice=excluded.askingPrice,
      grossRevenue=excluded.grossRevenue,
      cashFlow=excluded.cashFlow,
      ebitda=excluded.ebitda,
      yearEstablished=excluded.yearEstablished,
      employeesRange=excluded.employeesRange,
      freeholdValue=excluded.freeholdValue,
      reconstitutedProfit=excluded.reconstitutedProfit,
      reconstitutedProfitPercent=excluded.reconstitutedProfitPercent,
      udasCount=excluded.udasCount,
      udasPricePerUda=excluded.udasPricePerUda,
      companyType=excluded.companyType,
      detailedInformationText=excluded.detailedInformationText,
      confidential=excluded.confidential,
      financingAvailable=excluded.financingAvailable,
      photosJson=excluded.photosJson,
      updatedAt=excluded.updatedAt
    `,
    [
      input.id,
      input.status,
      input.featured ? 1 : 0,
      JSON.stringify(input.tags ?? []),
      input.moreInfoUrl ?? null,
      input.title,
      input.industry,
      input.summary,
      input.locationCity,
      input.locationState,
      input.latitude ?? null,
      input.longitude ?? null,
      input.askingPrice,
      input.grossRevenue ?? null,
      input.cashFlow ?? null,
      input.ebitda ?? null,
      input.yearEstablished ?? null,
      input.employeesRange ?? null,
      input.freeholdValue ?? null,
      input.reconstitutedProfit ?? null,
      input.reconstitutedProfitPercent ?? null,
      input.udasCount ?? null,
      input.udasPricePerUda ?? null,
      input.companyType ?? null,
      input.detailedInformationText ?? null,
      input.confidential ? 1 : 0,
      input.financingAvailable ? 1 : 0,
      JSON.stringify(input.photos ?? []),
      input.createdAt ?? nowIso,
      input.updatedAt ?? nowIso,
    ],
  );
}

export async function setListingStatus(id: string, status: ListingStatus) {
  const db = await getDbHandle();
  await db.runAsync('UPDATE listings SET status = ?, updatedAt = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id,
  ]);
}

