import type { Listing } from '@/src/domain/types';
import { lookupUkLocation } from '@/src/geo/ukLocations';
import { getOsmStaticMapUrlCandidates } from '@/src/ui/map/staticMap';

export type ListingMapCoords = {
  latitude: number;
  longitude: number;
  source: 'exact' | 'lookup' | 'fallback';
};

function isUkListing(listing: Listing): boolean {
  const s = `${listing.locationState ?? ''}`.trim().toLowerCase();
  const c = `${listing.locationCity ?? ''}`.trim().toLowerCase();
  return s === 'uk' || s === 'united kingdom' || c === 'uk' || c === 'united kingdom' || s === 'gb';
}

export function getListingMapCoords(listing: Listing): ListingMapCoords | null {
  // Treat stored lat/lon as "exact" only for non-UK listings. UK listings are imported with
  // approximate centroids, and we prefer runtime lookup so improvements apply immediately.
  if (listing.latitude != null && listing.longitude != null && !isUkListing(listing)) {
    return { latitude: listing.latitude, longitude: listing.longitude, source: 'exact' };
  }

  const combined = `${listing.locationCity ?? ''} ${listing.locationState ?? ''}`.trim();
  const fromCombined = combined ? lookupUkLocation(combined) : null;
  if (fromCombined) return { ...fromCombined, source: 'lookup' };

  const fromTitle = listing.title ? lookupUkLocation(listing.title) : null;
  if (fromTitle) return { ...fromTitle, source: 'lookup' };

  const fromCity = listing.locationCity ? lookupUkLocation(listing.locationCity) : null;
  if (fromCity) return { ...fromCity, source: 'lookup' };

  const fromState = listing.locationState ? lookupUkLocation(listing.locationState) : null;
  if (fromState) return { ...fromState, source: 'lookup' };

  // Last resort: if this is UK data, show a UK-centered map rather than nothing.
  const ukFallback = lookupUkLocation('uk');
  if (ukFallback && (listing.locationState ?? '').trim().toLowerCase() === 'uk') {
    return { ...ukFallback, source: 'fallback' };
  }

  return ukFallback ? { ...ukFallback, source: 'fallback' } : null;
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

