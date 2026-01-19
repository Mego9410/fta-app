import * as Linking from 'expo-linking';

import type { Lead, Listing } from '@/src/domain/types';
import { requireSupabase, isSupabaseConfigured } from '@/src/supabase/client';
import { formatCurrency } from '@/src/ui/format';

type InquiryLead = Pick<Lead, 'id' | 'name' | 'email' | 'phone' | 'message' | 'createdAt'>;

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
  const subject = buildSubject(input.listing);
  const body = buildTextBody(input);

  if (isSupabaseConfigured) {
    const supabase = requireSupabase();
    const res = await supabase.functions.invoke('inquiry-email', {
      body: {
        listing: {
          id: input.listing.id,
          title: input.listing.title,
          industry: input.listing.industry,
          locationCity: input.listing.locationCity,
          locationState: input.listing.locationState,
          askingPrice: input.listing.askingPrice,
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
        text: body,
      },
    });

    if (res.error) {
      throw new Error(res.error.message);
    }
    return;
  }

  const to = process.env.EXPO_PUBLIC_INQUIRY_TO_EMAIL?.trim();
  if (!to) {
    throw new Error(
      'Email notifications are not configured. Set EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY (recommended) or EXPO_PUBLIC_INQUIRY_TO_EMAIL (mailto fallback).',
    );
  }

  const url = buildMailtoUrl(to, subject, body);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('Could not open mail composer on this device.');
  }
  await Linking.openURL(url);
}

