import type { Lead } from '@/src/domain/types';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';

type SellerLead = Pick<
  Lead,
  | 'id'
  | 'name'
  | 'email'
  | 'phone'
  | 'callbackWindow'
  | 'message'
  | 'industry'
  | 'location'
  | 'incomeMix'
  | 'practiceType'
  | 'surgeriesCount'
  | 'tenure'
  | 'readiness'
  | 'timeline'
  | 'revenueRange'
  | 'earningsRange'
  | 'createdAt'
>;

export type SellerIntakeEmailInput = {
  lead: SellerLead;
};

function buildSubject(lead: SellerLead) {
  return `Callback request: Sell a practice (${lead.id})`;
}

function buildTextBody({ lead }: SellerIntakeEmailInput) {
  const lines: string[] = [];
  lines.push('New seller callback request');
  lines.push('');
  lines.push('User');
  lines.push(`- Name: ${lead.name}`);
  lines.push(`- Email: ${lead.email ?? ''}`);
  lines.push(`- Phone: ${lead.phone ?? ''}`);
  lines.push(`- Preferred callback time: ${lead.callbackWindow ?? ''}`);
  lines.push(`- Message: ${lead.message ?? ''}`);
  lines.push('');
  lines.push('Practice');
  lines.push(`- Industry: ${lead.industry ?? ''}`);
  lines.push(`- Location: ${lead.location ?? ''}`);
  lines.push(`- Income mix: ${lead.incomeMix ?? ''}`);
  lines.push(`- Practice type: ${lead.practiceType ?? ''}`);
  lines.push(`- Surgeries: ${lead.surgeriesCount ?? ''}`);
  lines.push(`- Freehold/leasehold: ${lead.tenure ?? ''}`);
  lines.push(`- Ready now/future: ${lead.readiness ?? ''}`);
  lines.push(`- Timeline: ${lead.timeline ?? ''}`);
  lines.push(`- Revenue range: ${lead.revenueRange ?? ''}`);
  lines.push(`- Earnings range: ${lead.earningsRange ?? ''}`);
  lines.push('');
  lines.push(`- Lead ID: ${lead.id}`);
  lines.push(`- Submitted: ${lead.createdAt}`);
  return lines.join('\n');
}

export function buildSellerIntakeEmailPayload(input: SellerIntakeEmailInput) {
  const subject = buildSubject(input.lead);
  const text = buildTextBody(input);
  return {
    lead: {
      id: input.lead.id,
      name: input.lead.name,
      email: input.lead.email,
      phone: input.lead.phone,
      callbackWindow: input.lead.callbackWindow,
      message: input.lead.message,
      industry: input.lead.industry,
      location: input.lead.location,
      incomeMix: input.lead.incomeMix,
      practiceType: input.lead.practiceType,
      surgeriesCount: input.lead.surgeriesCount,
      tenure: input.lead.tenure,
      readiness: input.lead.readiness,
      timeline: input.lead.timeline,
      revenueRange: input.lead.revenueRange,
      earningsRange: input.lead.earningsRange,
      createdAt: input.lead.createdAt,
    },
    subject,
    text,
  };
}

/**
 * Notifies the team about a "sell a practice" callback request.
 * Uses the seller-intake-email Edge Function (Resend) only; never opens the device email app.
 */
export async function notifySellerIntakeByEmail(input: SellerIntakeEmailInput): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Email is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to send requests directly.',
    );
  }

  const payload = buildSellerIntakeEmailPayload(input);
  const supabase = requireSupabase();
  const res = await supabase.functions.invoke('seller-intake-email', {
    body: payload,
  });

  if (res.error) {
    throw new Error(res.error.message ?? 'Failed to send request. Please try again.');
  }
}

