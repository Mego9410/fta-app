import type { Lead, Listing } from '@/src/domain/types';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';
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

/**
 * Sends a notification email to the team about a "request details" enquiry.
 * Uses the inquiry-email Edge Function (Resend) only; never opens the device email app.
 */
export async function notifyInquiryByEmail(input: InquiryEmailInput): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Email is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to send requests directly.',
    );
  }

  const payload = buildInquiryEmailPayload(input);
  const supabase = requireSupabase();
  const res = await supabase.functions.invoke('inquiry-email', {
    body: payload,
  });

  if (res.error) {
    let message = res.error.message ?? 'Failed to send request. Please try again.';
    const raw =
      (res as { response?: Response }).response ??
      (res.error as { context?: Response }).context;
    if (raw) {
      try {
        const body =
          typeof (raw as Response).json === 'function'
            ? await (raw as Response).json()
            : JSON.parse(await (raw as Response).text());
        if (typeof body?.error === 'string') message = body.error;
        else if (body?.details != null) message = String(body.details);
      } catch {
        // keep generic message if body isn't JSON or already consumed
      }
    }
    if (__DEV__) {
      const host = typeof process.env.EXPO_PUBLIC_SUPABASE_URL === 'string'
        ? new URL(process.env.EXPO_PUBLIC_SUPABASE_URL).host
        : 'unknown';
      console.warn(
        '[inquiry-email] Edge Function error. Supabase host:',
        host,
        '| Message:',
        message
      );
    }
    throw new Error(message);
  }
}

