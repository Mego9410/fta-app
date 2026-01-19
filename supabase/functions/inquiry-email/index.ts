// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { corsHeaders } from '../_shared/cors.ts';

type ListingPayload = {
  id: string;
  title: string;
  industry?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  askingPrice?: number | null;
  moreInfoUrl?: string | null;
};

type LeadPayload = {
  id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  createdAt?: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function asString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const toEmail = (Deno.env.get('INQUIRY_TO_EMAIL') ?? '').trim() || 'oliver.acton@ft-associates.com';
  const fromEmail = Deno.env.get('INQUIRY_FROM_EMAIL') ?? '';

  if (!resendApiKey || !fromEmail) {
    return json(500, {
      error:
        'Email function is not configured. Set RESEND_API_KEY and INQUIRY_FROM_EMAIL in Supabase function secrets. (INQUIRY_TO_EMAIL is optional.)',
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const listing: ListingPayload | null = payload?.listing ?? null;
  const lead: LeadPayload | null = payload?.lead ?? null;

  if (!listing?.id || !listing?.title || !lead?.name) {
    return json(400, { error: 'Missing required fields: listing.id, listing.title, lead.name' });
  }

  const subject =
    asString(payload?.subject)?.trim() || `Request details: ${listing.title} (${listing.id})`;

  const askingPriceText =
    typeof listing.askingPrice === 'number'
      ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(listing.askingPrice)
      : null;

  const text =
    asString(payload?.text)?.trim() ||
    [
      'New request for details',
      '',
      'Practice / listing',
      `- ID: ${listing.id}`,
      `- Title: ${listing.title}`,
      listing.industry ? `- Industry: ${listing.industry}` : null,
      listing.locationCity || listing.locationState
        ? `- Location: ${listing.locationCity ?? ''}${listing.locationCity && listing.locationState ? ', ' : ''}${
            listing.locationState ?? ''
          }`.trim()
        : null,
      askingPriceText ? `- Asking price: ${askingPriceText}` : null,
      listing.moreInfoUrl ? `- More info: ${listing.moreInfoUrl}` : null,
      '',
      'User',
      `- Name: ${lead.name}`,
      lead.email ? `- Email: ${lead.email}` : null,
      lead.phone ? `- Phone: ${lead.phone}` : null,
      lead.message ? `- Message: ${lead.message}` : null,
      lead.id ? `- Lead ID: ${lead.id}` : null,
      lead.createdAt ? `- Submitted: ${lead.createdAt}` : null,
    ]
      .filter(Boolean)
      .join('\n');

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <h2 style="margin:0 0 12px 0;">New request for details</h2>
      <h3 style="margin:18px 0 8px 0;">Practice / listing</h3>
      <ul>
        <li><strong>ID:</strong> ${escapeHtml(listing.id)}</li>
        <li><strong>Title:</strong> ${escapeHtml(listing.title)}</li>
        ${
          listing.industry
            ? `<li><strong>Industry:</strong> ${escapeHtml(String(listing.industry))}</li>`
            : ''
        }
        ${
          listing.locationCity || listing.locationState
            ? `<li><strong>Location:</strong> ${escapeHtml(
                `${listing.locationCity ?? ''}${listing.locationCity && listing.locationState ? ', ' : ''}${
                  listing.locationState ?? ''
                }`.trim(),
              )}</li>`
            : ''
        }
        ${
          typeof listing.askingPrice === 'number'
            ? `<li><strong>Asking price:</strong> ${escapeHtml(String(askingPriceText ?? listing.askingPrice))}</li>`
            : ''
        }
        ${listing.moreInfoUrl ? `<li><strong>More info:</strong> ${escapeHtml(String(listing.moreInfoUrl))}</li>` : ''}
      </ul>

      <h3 style="margin:18px 0 8px 0;">User</h3>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(lead.name)}</li>
        ${lead.email ? `<li><strong>Email:</strong> ${escapeHtml(String(lead.email))}</li>` : ''}
        ${lead.phone ? `<li><strong>Phone:</strong> ${escapeHtml(String(lead.phone))}</li>` : ''}
        ${
          lead.message
            ? `<li><strong>Message:</strong><br/><pre style="white-space:pre-wrap; margin:6px 0 0 0;">${escapeHtml(
                String(lead.message),
              )}</pre></li>`
            : ''
        }
        ${lead.id ? `<li><strong>Lead ID:</strong> ${escapeHtml(String(lead.id))}</li>` : ''}
        ${
          lead.createdAt
            ? `<li><strong>Submitted:</strong> ${escapeHtml(String(lead.createdAt))}</li>`
            : ''
        }
      </ul>
    </div>
  `.trim();

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      text,
      html,
    }),
  });

  if (!resendResp.ok) {
    const errText = await resendResp.text().catch(() => '');
    return json(502, { error: 'Failed to send email', details: errText });
  }

  const resendJson = await resendResp.json().catch(() => ({}));
  return json(200, { ok: true, provider: 'resend', result: resendJson });
});

