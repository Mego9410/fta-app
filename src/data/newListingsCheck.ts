import type { Listing } from '@/src/domain/types';
import { getMetaValue, setMetaValue } from '@/src/data/db';
import { getSearchPreferences } from '@/src/data/preferencesRepo';
import { getProfileSettings } from '@/src/data/profileSettingsRepo';
import { haversineMiles, type LatLng } from '@/src/geo/haversine';
import { lookupUkLocation } from '@/src/geo/ukLocations';
import { getSurgeriesCountFromTags } from '@/src/ui/searchFilters';
import { scheduleNotification } from '@/src/notifications/notifications';
import { requireSupabase } from '@/src/supabase/client';

const META_LAST_NOTIFIED_AT = 'notifications.lastNotifiedAt.v1';

/**
 * Get the timestamp of the last successful notification check.
 * Returns null if never checked before.
 */
export async function getLastNotifiedAt(): Promise<string | null> {
  const value = await getMetaValue(META_LAST_NOTIFIED_AT);
  return value && value.trim().length > 0 ? value : null;
}

/**
 * Update the timestamp of the last successful notification check.
 */
async function setLastNotifiedAt(timestamp: string): Promise<void> {
  await setMetaValue(META_LAST_NOTIFIED_AT, timestamp);
}

/**
 * Fetch new listings created after the last notified timestamp.
 */
async function fetchNewListings(): Promise<Listing[]> {
  const lastNotifiedAt = await getLastNotifiedAt();
  
  try {
    const supabase = requireSupabase();
    let query = supabase.from('listings').select('*').eq('status', 'active');

    // If we have a last notified timestamp, filter by created_at
    if (lastNotifiedAt) {
      query = query.gt('created_at', lastNotifiedAt);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch new listings:', error);
      return [];
    }

    // Map to Listing type
    return (data || []).map((row: any) => ({
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
      reconstitutedProfitPercent:
        row.reconstituted_profit_percent == null ? null : Number(row.reconstituted_profit_percent),
      udasCount: row.udas_count == null ? null : Number(row.udas_count),
      udasPricePerUda: row.udas_price_per_uda == null ? null : Number(row.udas_price_per_uda),
      companyType: row.company_type ?? null,
      detailedInformationText: row.detailed_information_text ?? null,
      confidential: !!row.confidential,
      financingAvailable: !!row.financing_available,
      photos: Array.isArray(row.photos_json) ? row.photos_json : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (e) {
    console.warn('Error fetching new listings:', e);
    return [];
  }
}

/**
 * Filter listings based on user's search preferences.
 */
async function filterListingsByPreferences(listings: Listing[]): Promise<Listing[]> {
  const prefs = await getSearchPreferences();
  if (!prefs) {
    // No preferences means no filtering - return all
    return listings;
  }

  let filtered = listings;

  // Filter by keyword
  if (prefs.keyword && prefs.keyword.trim().length > 0) {
    const keyword = prefs.keyword.trim().toLowerCase();
    filtered = filtered.filter((listing) => {
      const hay = `${listing.title} ${listing.industry} ${listing.summary} ${listing.locationCity} ${listing.locationState}`.toLowerCase();
      return hay.includes(keyword);
    });
  }

  // Filter by surgeries count
  if (prefs.surgeriesMax > 0) {
    filtered = filtered.filter((listing) => {
      const surgeriesCount = getSurgeriesCountFromTags(listing.tags);
      if (surgeriesCount === null) return true; // Include listings without surgery count
      return surgeriesCount <= prefs.surgeriesMax;
    });
  }

  // Filter by fee income (gross revenue)
  if (prefs.feeIncomeMax > 0) {
    filtered = filtered.filter((listing) => {
      if (listing.grossRevenue === null) return true; // Include listings without revenue
      return listing.grossRevenue <= prefs.feeIncomeMax;
    });
  }

  // Filter by property types (from tags)
  if (prefs.propertyTypes.length > 0) {
    filtered = filtered.filter((listing) => {
      const tags = listing.tags || [];
      return prefs.propertyTypes.some((propType) => tags.includes(propType));
    });
  }

  // Filter by income types (from tags or summary)
  if (prefs.incomeTypes.length > 0) {
    filtered = filtered.filter((listing) => {
      const tags = listing.tags || [];
      const summary = listing.summary?.toLowerCase() || '';
      
      return prefs.incomeTypes.some((incomeType) => {
        // Check tags
        if (tags.some((tag) => tag.toLowerCase().includes(incomeType.toLowerCase()))) {
          return true;
        }
        // Check summary for NHS/Private/Mixed mentions
        if (summary.includes(incomeType.toLowerCase())) {
          return true;
        }
        return false;
      });
    });
  }

  // Filter by location/radius
  if (prefs.locationText && prefs.locationText.trim().length > 0 && prefs.radiusMiles > 0) {
    try {
      // Look up coordinates for the search location
      const searchLocation = lookupLocationCoordinates(prefs.locationText);
      
      if (searchLocation) {
        filtered = filtered.filter((listing) => {
          if (listing.latitude === null || listing.longitude === null) {
            // Include listings without coordinates if we can't determine distance
            return true;
          }
          
          const distanceMiles = haversineMiles(searchLocation, {
            latitude: listing.latitude,
            longitude: listing.longitude,
          });
          
          return distanceMiles <= prefs.radiusMiles;
        });
      }
    } catch (e) {
      console.warn('Error filtering by location:', e);
      // If location lookup fails, don't filter by location
    }
  }

  return filtered;
}

/**
 * Look up coordinates for a location name using UK locations lookup.
 */
function lookupLocationCoordinates(locationText: string): LatLng | null {
  return lookupUkLocation(locationText);
}

/**
 * Format currency for notification display.
 */
function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `£${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

/**
 * Check for new listings and send notifications if enabled.
 * This is called by the background fetch task.
 */
export async function checkForNewListings(): Promise<void> {
  try {
    // Get user's notification preferences
    const settings = await getProfileSettings();
    
    // Check if notifications are enabled
    if (!settings.pushNewListings) {
      console.log('New listings notifications are disabled, skipping check');
      return;
    }

    // Fetch new listings
    let newListings = await fetchNewListings();
    
    // If this is the first run (no lastNotifiedAt), don't notify about existing listings
    const lastNotifiedAt = await getLastNotifiedAt();
    if (!lastNotifiedAt && newListings.length > 0) {
      console.log('First notification check - setting initial timestamp without notifying');
      await setLastNotifiedAt(new Date().toISOString());
      return;
    }

    // If no new listings, we're done
    if (newListings.length === 0) {
      console.log('No new listings found');
      return;
    }

    // Apply search filters if enabled
    if (settings.useSearchFilters) {
      newListings = await filterListingsByPreferences(newListings);
      console.log(`Filtered to ${newListings.length} matching listings`);
    }

    // If no matching listings after filtering, update timestamp anyway to avoid repeated checks
    if (newListings.length === 0) {
      console.log('No listings match search criteria, updating timestamp');
      await setLastNotifiedAt(new Date().toISOString());
      return;
    }

    // Send notifications for each new listing
    for (const listing of newListings) {
      const title = 'Frank Taylor & Associates';
      const location = listing.locationState?.toUpperCase() === 'UK' 
        ? listing.locationCity 
        : `${listing.locationCity}, ${listing.locationState}`;
      const price = formatCurrency(listing.askingPrice);
      const body = `New Practice! - ${location}, ${price}`;

      await scheduleNotification(title, body, {
        listingId: listing.id,
        type: 'new_listing',
      });
    }

    // Update last notified timestamp
    await setLastNotifiedAt(new Date().toISOString());
    console.log(`Sent ${newListings.length} notification(s) for new listings`);
  } catch (error) {
    console.error('Error checking for new listings:', error);
    // Don't update timestamp on error - we'll retry next time
  }
}
