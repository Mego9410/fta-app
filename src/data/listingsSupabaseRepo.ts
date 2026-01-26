import { requireSupabase } from '@/src/supabase/client';
import type { Listing, ListingStatus } from '@/src/domain/types';

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
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    moreInfoUrl: row.more_info_url ?? null,
    title: row.title,
    industry: row.industry,
    summary: row.summary,
    locationCity: row.location_city,
    locationState: row.location_state,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    askingPrice: Number(row.asking_price),
    grossRevenue: row.gross_revenue == null ? null : Number(row.gross_revenue),
    cashFlow: row.cash_flow == null ? null : Number(row.cash_flow),
    ebitda: row.ebitda == null ? null : Number(row.ebitda),
    yearEstablished: row.year_established == null ? null : Number(row.year_established),
    employeesRange: row.employees_range ?? null,
    freeholdValue: row.freehold_value == null ? null : Number(row.freehold_value),
    reconstitutedProfit: row.reconstituted_profit == null ? null : Number(row.reconstituted_profit),
    reconstitutedProfitPercent: row.reconstituted_profit_percent == null ? null : Number(row.reconstituted_profit_percent),
    udasCount: row.udas_count == null ? null : Number(row.udas_count),
    udasPricePerUda: row.udas_price_per_uda == null ? null : Number(row.udas_price_per_uda),
    companyType: row.company_type ?? null,
    detailedInformationText: row.detailed_information_text ?? null,
    confidential: !!row.confidential,
    financingAvailable: !!row.financing_available,
    photos: Array.isArray(row.photos_json) ? row.photos_json : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List listings from Supabase with optional filters.
 * Falls back to empty array if Supabase is not configured or query fails.
 */
export async function listListingsFromSupabase(query: ListingsQuery = {}): Promise<Listing[]> {
  try {
    const supabase = requireSupabase();
    
    // Build base query
    const buildQuery = () => {
      let q = supabase.from('listings').select('*', { count: 'exact' });
      if (query.status) {
        q = q.eq('status', query.status);
      }
      if (query.featuredOnly) {
        q = q.eq('featured', 1);
      }
      if (query.industry) {
        q = q.eq('industry', query.industry);
      }
      if (query.locationState) {
        q = q.eq('location_state', query.locationState);
      }
      if (query.minPrice != null) {
        q = q.gte('asking_price', query.minPrice);
      }
      if (query.maxPrice != null) {
        q = q.lte('asking_price', query.maxPrice);
      }
      if (query.confidentialOnly) {
        q = q.eq('confidential', 1);
      }
      if (query.financingOnly) {
        q = q.eq('financing_available', 1);
      }
      return q.order('featured', { ascending: false }).order('updated_at', { ascending: false });
    };

    // Fetch all listings with pagination (Supabase default limit is 1000)
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error, count } = await buildQuery().range(from, from + pageSize - 1);

      if (error) {
        console.warn('Failed to fetch listings from Supabase:', error);
        return [];
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize && (count === null || from < count);
      } else {
        hasMore = false;
      }
    }

    let listings = allData.map(rowToListing);

    // Keyword filtering (client-side since Supabase doesn't support multi-column LIKE easily)
    if (query.keyword) {
      const kw = query.keyword.trim().toLowerCase();
      if (kw) {
        listings = listings.filter((l) => {
          const hay = `${l.title} ${l.industry} ${l.summary} ${l.locationCity} ${l.locationState}`.toLowerCase();
          return hay.includes(kw);
        });
      }
    }

    return listings;
  } catch (e) {
    console.warn('Supabase not configured or error fetching listings:', e);
    return [];
  }
}

/**
 * Get a single listing by ID from Supabase.
 * Falls back to null if Supabase is not configured or query fails.
 */
export async function getListingByIdFromSupabase(id: string): Promise<Listing | null> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('listings').select('*').eq('id', id).single();

    if (error || !data) {
      console.warn(`Failed to fetch listing ${id} from Supabase:`, error);
      return null;
    }

    return rowToListing(data);
  } catch (e) {
    console.warn(`Supabase not configured or error fetching listing ${id}:`, e);
    return null;
  }
}
