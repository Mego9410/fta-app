import type { Listing } from '@/src/domain/types';
import { lookupUkLocation } from '@/src/geo/ukLocations';
import { getOsmStaticMapUrlCandidates } from '@/src/ui/map/staticMap';

export type ListingMapCoords = {
  latitude: number;
  longitude: number;
  source: 'exact' | 'lookup' | 'fallback';
  locationName?: string; // The matched location name for radius calculation
};

function isUkListing(listing: Listing): boolean {
  const s = `${listing.locationState ?? ''}`.trim().toLowerCase();
  const c = `${listing.locationCity ?? ''}`.trim().toLowerCase();
  return s === 'uk' || s === 'united kingdom' || c === 'uk' || c === 'united kingdom' || s === 'gb';
}

// Helper function to find the matched location name by trying lookups in order
// Returns the original location string (not normalized) for better Nominatim matching
function findMatchedLocationName(listing: Listing): string | null {
  // Try combined first (most specific)
  const combined = `${listing.locationCity ?? ''} ${listing.locationState ?? ''}`.trim();
  if (combined && lookupUkLocation(combined)) {
    return combined; // Return original, not normalized
  }

  // Try title
  if (listing.title && lookupUkLocation(listing.title)) {
    return listing.title; // Return original
  }

  // Try city
  if (listing.locationCity && lookupUkLocation(listing.locationCity)) {
    return listing.locationCity; // Return original
  }

  // Try state
  if (listing.locationState && lookupUkLocation(listing.locationState)) {
    return listing.locationState; // Return original
  }

  return null;
}

// Normalize location name for matching (similar to ukLocations normalizeKey)
function normalizeLocationName(input: string): string {
  return input
    .toLowerCase()
    .replace(/\b(u\.?\s*k\.?)\b/g, ' uk ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getListingMapCoords(listing: Listing): ListingMapCoords | null {
  // Treat stored lat/lon as "exact" only for non-UK listings. UK listings are imported with
  // approximate centroids, and we prefer runtime lookup so improvements apply immediately.
  if (listing.latitude != null && listing.longitude != null && !isUkListing(listing)) {
    return { latitude: listing.latitude, longitude: listing.longitude, source: 'exact' };
  }

  const combined = `${listing.locationCity ?? ''} ${listing.locationState ?? ''}`.trim();
  const fromCombined = combined ? lookupUkLocation(combined) : null;
  if (fromCombined) {
    return { ...fromCombined, source: 'lookup', locationName: findMatchedLocationName(listing) ?? undefined };
  }

  const fromTitle = listing.title ? lookupUkLocation(listing.title) : null;
  if (fromTitle) {
    return { ...fromTitle, source: 'lookup', locationName: findMatchedLocationName(listing) ?? undefined };
  }

  const fromCity = listing.locationCity ? lookupUkLocation(listing.locationCity) : null;
  if (fromCity) {
    return { ...fromCity, source: 'lookup', locationName: findMatchedLocationName(listing) ?? undefined };
  }

  const fromState = listing.locationState ? lookupUkLocation(listing.locationState) : null;
  if (fromState) {
    return { ...fromState, source: 'lookup', locationName: findMatchedLocationName(listing) ?? undefined };
  }

  // Last resort: if this is UK data, show a UK-centered map rather than nothing.
  const ukFallback = lookupUkLocation('uk');
  if (ukFallback && (listing.locationState ?? '').trim().toLowerCase() === 'uk') {
    return { ...ukFallback, source: 'fallback', locationName: 'uk' };
  }

  return ukFallback ? { ...ukFallback, source: 'fallback', locationName: 'uk' } : null;
}

export function getListingMapUrl(
  listing: Listing,
  options?: { width?: number; height?: number; zoom?: number },
): { urls: string[]; coords: ListingMapCoords } | null {
  const coords = getListingMapCoords(listing);
  if (!coords) return null;
  return {
    coords,
    urls: getOsmStaticMapUrlCandidates({
      latitude: coords.latitude,
      longitude: coords.longitude,
      width: options?.width,
      height: options?.height,
      zoom: options?.zoom,
    }),
  };
}

/**
 * Get the appropriate area radius in meters based on the location.
 * Uses location-specific radii for better accuracy:
 * - London sub-regions: 3-5km (small, precise areas)
 * - Major cities: 5-8km
 * - Counties: 15-25km (large areas like Essex)
 * - Regions: 30-50km
 * - Exact coordinates: 2km (very precise)
 */
export function getListingAreaRadius(coords: ListingMapCoords): number {
  // Exact coordinates get a small radius
  if (coords.source === 'exact') {
    return 2000; // 2km for exact locations
  }

  // Use location-specific radius if available
  if (coords.locationName) {
    const normalized = coords.locationName.toLowerCase().trim();
    
    // London sub-regions - small, precise areas
    if (normalized.includes('central london')) return 3000; // 3km
    if (normalized.includes('north london') || normalized.includes('south london') || 
        normalized.includes('east london') || normalized.includes('west london')) {
      return 4000; // 4km
    }
    if (normalized.includes('north west london') || normalized.includes('north east london') ||
        normalized.includes('south east london') || normalized.includes('south west london')) {
      return 5000; // 5km
    }
    if (normalized.includes('greater london') || normalized === 'london') {
      return 12000; // 12km for all of London
    }

    // Major cities - medium radius
    const majorCities = ['birmingham', 'manchester', 'liverpool', 'leeds', 'bristol', 
                         'cardiff', 'glasgow', 'edinburgh', 'newcastle', 'nottingham',
                         'sheffield', 'leicester', 'oxford', 'cambridge', 'brighton',
                         'reading', 'belfast', 'york', 'norwich'];
    if (majorCities.some(city => normalized.includes(city))) {
      return 6000; // 6km for major cities
    }

    // Large counties - larger radius
    const largeCounties = ['essex', 'kent', 'yorkshire', 'lancashire', 'devon', 'cornwall',
                           'norfolk', 'suffolk', 'cumbria', 'northamptonshire', 'warwickshire',
                           'staffordshire', 'cheshire', 'hampshire', 'dorset', 'somerset'];
    if (largeCounties.some(county => normalized.includes(county))) {
      return 20000; // 20km for large counties
    }

    // Medium counties
    const mediumCounties = ['surrey', 'west sussex', 'east sussex', 'sussex', 'berkshire',
                            'buckinghamshire', 'bedfordshire', 'hertfordshire', 'merseyside'];
    if (mediumCounties.some(county => normalized.includes(county))) {
      return 12000; // 12km for medium counties
    }

    // Large regions
    if (normalized.includes('east of england') || normalized.includes('east anglia') ||
        normalized.includes('west of england') || normalized.includes('south east') ||
        normalized.includes('south west') || normalized.includes('north west') ||
        normalized.includes('north east') || normalized.includes('west midlands') ||
        normalized.includes('east midlands') || normalized.includes('yorkshire and the humber')) {
      return 35000; // 35km for large regions
    }

    // Country-level fallbacks
    if (normalized === 'uk' || normalized === 'united kingdom' || normalized === 'england' ||
        normalized === 'scotland' || normalized === 'wales' || normalized === 'northern ireland') {
      return 50000; // 50km for countries
    }
  }

  // Default based on source if no location name
  switch (coords.source) {
    case 'lookup':
      return 8000; // 8km default for lookups
    case 'fallback':
      return 30000; // 30km for fallbacks
    default:
      return 5000; // 5km default
  }
}