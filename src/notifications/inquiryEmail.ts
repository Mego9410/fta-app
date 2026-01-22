import * as Linking from 'expo-linking';

import type { Lead, Listing } from '@/src/domain/types';
import { requireSupabase, isSupabaseConfigured } from '@/src/supabase/client';
import { formatCurrency } from '@/src/ui/format';

type InquiryLead = Pick<Lead, 'id' | 'name' | 'email' | 'phone' | 'message' | 'createdAt'>;

const DEFAULT_INQUIRY_TO_EMAIL = 'oliver.acton@ft-associates.com';

export type InquiryEmailInput = {
  listing: Listing;
  lead: InquiryLead;
};

function buildSubject(listing: Listing) {
  const title = listing?.title?.trim() || 'Listing';
  return `Request details: ${title} (${listing.id})`;
}

function buildTextBody({ listing, lead }: InquiryEmailInput) {
  const lines: string[] = [];

  lines.push('New request for details');
  lines.push('');
  lines.push('Practice / listing');
  lines.push(`- ID: ${listing.id}`);
  lines.push(`- Title: ${listing.title}`);
  lines.push(`- Industry: ${listing.industry}`);
  lines.push(`- Location: ${listing.locationCity}, ${listing.locationState}`);
  lines.push(`- Asking price: ${formatCurrency(listing.askingPrice)}`);
  if (listing.moreInfoUrl) lines.push(`- More info: ${listing.moreInfoUrl}`);
  lines.push('');
  lines.push('User');
  lines.push(`- Name: ${lead.name}`);
  lines.push(`- Email: ${lead.email ?? ''}`);
  lines.push(`- Phone: ${lead.phone ?? ''}`);
  lines.push(`- Message: ${lead.message ?? ''}`);
  lines.push(`- Lead ID: ${lead.id}`);
  lines.push(`- Submitted: ${lead.createdAt}`);

  return lines.join('\n');
}

export function buildInquiryEmailPayload(input: InquiryEmailInput) {
  const subject = buildSubject(input.listing);
  const text = buildTextBody(input);
  return {
    listing: {
      id: input.listing.id,
      title: input.listing.title,
      industry: input.listing.industry,
      locationCity: input.listing.locationCity,
      locationState: input.listing.locationState,
      askingPrice: input.listing.askingPrice,
      moreInfoUrl: input.listing.moreInfoUrl ?? null,
    },
    lead: {
      id: input.lead.id,
      name: input.lead.name,
      email: input.lead.email,
      phone: input.lead.phone,
      message: input.lead.message,
      createdAt: input.lead.createdAt,
    },
    subject,
    text,
  };
}

function buildMailtoUrl(to: string, subject: string, body: string) {
  // Use encodeURIComponent to preserve newlines and punctuation.
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Sends a notification email to the team about a "request details" enquiry.
 *
 * Delivery order:
 * - If Supabase is configured: invokes the `inquiry-email` Edge Function to send automatically.
 * - Otherwise: falls back to opening a pre-filled mail composer via `mailto:`.
 */
export async function notifyInquiryByEmail(input: InquiryEmailInput): Promise<void> {
  const payload = buildInquiryEmailPayload(input);

  if (isSupabaseConfigured) {
    try {
      const supabase = requireSupabase();
      const res = await supabase.functions.invoke('inquiry-email', {
        body: payload,
      });

      if (!res.error) return;
      // If the function is misconfigured (common in early setup), fall back to mailto so the user can still send.
      console.warn('Inquiry email edge function failed; falling back to mailto composer', res.error);
    } catch (e) {
      console.warn('Inquiry email invoke threw; falling back to mailto composer', e);
    }
  }

  const to = process.env.EXPO_PUBLIC_INQUIRY_TO_EMAIL?.trim() || DEFAULT_INQUIRY_TO_EMAIL;

  const url = buildMailtoUrl(to, payload.subject, payload.text);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('Could not open mail composer on this device.');
  }
  await Linking.openURL(url);
}

