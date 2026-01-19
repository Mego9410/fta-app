import type { Listing } from '@/src/domain/types';

export type ListingDraft = {
  id: string;
  status: Listing['status'];
  featured: boolean;
  title: string;
  industry: string;
  summary: string;
  locationCity: string;
  locationState: string;
  askingPrice: string;
  grossRevenue: string;
  cashFlow: string;
  yearEstablished: string;
  employeesRange: string;
  confidential: boolean;
  financingAvailable: boolean;
  photos: string[];
};

export function listingToDraft(listing: Listing): ListingDraft {
  return {
    id: listing.id,
    status: listing.status,
    featured: listing.featured,
    title: listing.title,
    industry: listing.industry,
    summary: listing.summary,
    locationCity: listing.locationCity,
    locationState: listing.locationState,
    askingPrice: String(listing.askingPrice ?? ''),
    grossRevenue: listing.grossRevenue != null ? String(listing.grossRevenue) : '',
    cashFlow: listing.cashFlow != null ? String(listing.cashFlow) : '',
    yearEstablished: listing.yearEstablished != null ? String(listing.yearEstablished) : '',
    employeesRange: listing.employeesRange ?? '',
    confidential: listing.confidential,
    financingAvailable: listing.financingAvailable,
    photos: listing.photos ?? [],
  };
}

export function blankDraft(id: string): ListingDraft {
  return {
    id,
    status: 'active',
    featured: false,
    title: '',
    industry: '',
    summary: '',
    locationCity: '',
    locationState: 'TX',
    askingPrice: '',
    grossRevenue: '',
    cashFlow: '',
    yearEstablished: '',
    employeesRange: '',
    confidential: true,
    financingAvailable: false,
    photos: [],
  };
}

function parseIntOrNull(value: string): number | null {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

export function draftToUpsertInput(draft: ListingDraft) {
  const asking = parseIntOrNull(draft.askingPrice) ?? 0;
  return {
    id: draft.id,
    status: draft.status,
    featured: draft.featured,
    tags: [] as string[],
    moreInfoUrl: null as string | null,
    title: draft.title.trim(),
    industry: draft.industry.trim(),
    summary: draft.summary.trim(),
    locationCity: draft.locationCity.trim(),
    locationState: draft.locationState.trim(),
    latitude: null as number | null,
    longitude: null as number | null,
    askingPrice: asking,
    grossRevenue: parseIntOrNull(draft.grossRevenue),
    cashFlow: parseIntOrNull(draft.cashFlow),
    ebitda: null,
    yearEstablished: parseIntOrNull(draft.yearEstablished),
    employeesRange: draft.employeesRange.trim() || null,
    confidential: draft.confidential,
    financingAvailable: draft.financingAvailable,
    photos: draft.photos ?? [],
  };
}

export function validateDraft(draft: ListingDraft): string | null {
  if (!draft.title.trim()) return 'Title is required.';
  if (!draft.industry.trim()) return 'Industry is required.';
  if (!draft.locationCity.trim() || !draft.locationState.trim()) return 'Location (city/state) is required.';
  const asking = draft.askingPrice.replace(/[^0-9]/g, '');
  if (!asking) return 'Asking price is required.';
  if (!draft.summary.trim()) return 'Summary is required.';
  return null;
}

