export type ListingStatus = 'active' | 'archived';

export type Listing = {
  id: string;
  status: ListingStatus;
  featured: boolean;

  tags: string[];

  moreInfoUrl?: string | null;

  title: string;
  industry: string;
  summary: string;

  locationCity: string;
  locationState: string;

  latitude?: number | null;
  longitude?: number | null;

  askingPrice: number;
  grossRevenue?: number | null;
  cashFlow?: number | null;
  ebitda?: number | null;

  yearEstablished?: number | null;
  employeesRange?: string | null;

  confidential: boolean;
  financingAvailable: boolean;

  photos: string[];

  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type LeadType = 'buyerInquiry' | 'sellerIntake';

export type Lead = {
  id: string;
  type: LeadType;
  listingId?: string | null;

  name: string;
  email?: string | null;
  phone?: string | null;
  /** Seller callback preference (e.g., "Weekdays after 5pm") */
  callbackWindow?: string | null;
  message?: string | null;

  // Seller-intake oriented fields (optional)
  industry?: string | null;
  location?: string | null;
  incomeMix?: 'NHS' | 'Private' | 'Mixed' | null;
  practiceType?: 'General' | 'Specialist' | 'Specialist Referral' | 'General with some Specialist' | null;
  surgeriesCount?: number | null;
  tenure?: 'Freehold' | 'Leasehold' | null;
  readiness?: 'Ready now' | 'Future' | null;
  timeline?: string | null;
  revenueRange?: string | null;
  earningsRange?: string | null;

  createdAt: string; // ISO
};

export type SearchPreferences = {
  keyword: string;
  surgeriesMax: number;
  feeIncomeMax: number;
  propertyTypes: string[];
  incomeTypes: string[];
  locationText: string;
  radiusMiles: number;
};

export type ProfileSettings = {
  pushNewListings: boolean;
  pushSavedActivity: boolean;
  marketingEmails: boolean;
};
