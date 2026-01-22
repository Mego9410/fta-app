import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1?target=deno';

import { corsHeaders } from '../_shared/cors.ts';

type LeadPayload = {
  id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  callbackWindow?: string | null;
  message?: string | null;
  industry?: string | null;
  location?: string | null;
  incomeMix?: string | null;
  practiceType?: string | null;
  surgeriesCount?: number | null;
  tenure?: string | null;
  readiness?: string | null;
  timeline?: string | null;
  revenueRange?: string | null;
  earningsRange?: string | null;
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

function safe(v: unknown) {
  const s = asString(v).trim();
  return s ? s : '';
}

function nowIso() {
  return new Date().toISOString();
}

function minutesAgoIso(mins: number) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

function requireEnv(name: string) {
  const v = (Deno.env.get(name) ?? '').trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getAdminSupabase() {
  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const toEmail = Deno.env.get('INQUIRY_TO_EMAIL') ?? '';
  const fromEmail = Deno.env.get('INQUIRY_FROM_EMAIL') ?? '';

  if (!resendApiKey || !toEmail || !fromEmail) {
    return json(500, {
      error:
        'Email function is not configured. Set RESEND_API_KEY, INQUIRY_TO_EMAIL, and INQUIRY_FROM_EMAIL in Supabase function secrets.',
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const lead: LeadPayload | null = payload?.lead ?? null;
  if (!lead?.name || !lead?.id) {
    return json(400, { error: 'Missing required fields: lead.name, lead.id' });
  }

  // Abuse protection + idempotency: only send if a corresponding lead exists and hasn't been notified.
  try {
    const supabase = getAdminSupabase();
    const leadId = String(lead.id);

    const { data: leadRow, error: leadErr } = await supabase
      .from('leads')
      .select('id, type, email, phone, created_at, notified_at')
      .eq('id', leadId)
      .maybeSingle();
    if (leadErr) throw leadErr;

    if (!leadRow) {
      return json(400, { error: 'Unknown lead id. Persist lead first, then send email.' });
    }
    if (leadRow.type !== 'sellerIntake') {
      return json(400, { error: 'Lead type mismatch for seller-intake-email.' });
    }
    if (leadRow.notified_at) {
      return json(200, { ok: true, alreadyNotified: true });
    }

    // Simple rate-limit: max 3 seller intake leads per 10 minutes per email/phone.
    const keyEmail = (leadRow.email ?? '').trim();
    const keyPhone = (leadRow.phone ?? '').trim();
    if (keyEmail || keyPhone) {
      let q = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'sellerIntake')
        .gte('created_at', minutesAgoIso(10));
      if (keyEmail && keyPhone) q = q.or(`email.eq.${keyEmail},phone.eq.${keyPhone}`);
      else if (keyEmail) q = q.eq('email', keyEmail);
      else q = q.eq('phone', keyPhone);

      const { count, error: countErr } = await q;
      if (countErr) throw countErr;
      if ((count ?? 0) > 3) {
        return json(429, { error: 'Too many requests. Please wait and try again.' });
      }
    }
  } catch (e) {
    // If admin DB check isn't configured, fail closed (avoid becoming an open relay).
    return json(500, { error: 'Email function is not fully configured for abuse protection.', details: String(e) });
  }

  const subject = safe(payload?.subject) || `Callback request: Sell a practice${lead.id ? ` (${lead.id})` : ''}`;

  const text =
    safe(payload?.text) ||
    [
      'New seller callback request',
      '',
      'User',
      `- Name: ${lead.name}`,
      lead.email ? `- Email: ${lead.email}` : null,
      lead.phone ? `- Phone: ${lead.phone}` : null,
      lead.callbackWindow ? `- Preferred callback time: ${lead.callbackWindow}` : null,
      lead.message ? `- Message: ${lead.message}` : null,
      lead.id ? `- Lead ID: ${lead.id}` : null,
      lead.createdAt ? `- Submitted: ${lead.createdAt}` : null,
      '',
      'Practice',
      lead.industry ? `- Industry: ${lead.industry}` : null,
      lead.location ? `- Location: ${lead.location}` : null,
      lead.incomeMix ? `- Income mix: ${lead.incomeMix}` : null,
      lead.practiceType ? `- Practice type: ${lead.practiceType}` : null,
      typeof lead.surgeriesCount === 'number' ? `- Surgeries: ${lead.surgeriesCount}` : null,
      lead.tenure ? `- Freehold/leasehold: ${lead.tenure}` : null,
      lead.readiness ? `- Ready now/future: ${lead.readiness}` : null,
      lead.timeline ? `- Timeline: ${lead.timeline}` : null,
      lead.revenueRange ? `- Revenue range: ${lead.revenueRange}` : null,
      lead.earningsRange ? `- Earnings range: ${lead.earningsRange}` : null,
    ]
      .filter(Boolean)
      .join('\n');

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
      <h2 style="margin:0 0 12px 0;">New seller callback request</h2>
      <h3 style="margin:18px 0 8px 0;">User</h3>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(lead.name)}</li>
        ${lead.email ? `<li><strong>Email:</strong> ${escapeHtml(String(lead.email))}</li>` : ''}
        ${lead.phone ? `<li><strong>Phone:</strong> ${escapeHtml(String(lead.phone))}</li>` : ''}
        ${
          lead.callbackWindow
            ? `<li><strong>Preferred callback time:</strong> ${escapeHtml(String(lead.callbackWindow))}</li>`
            : ''
        }
        ${
          lead.message
            ? `<li><strong>Message:</strong><br/><pre style="white-space:pre-wrap; margin:6px 0 0 0;">${escapeHtml(
                String(lead.message),
              )}</pre></li>`
            : ''
        }
        ${lead.id ? `<li><strong>Lead ID:</strong> ${escapeHtml(String(lead.id))}</li>` : ''}
        ${lead.createdAt ? `<li><strong>Submitted:</strong> ${escapeHtml(String(lead.createdAt))}</li>` : ''}
      </ul>

      <h3 style="margin:18px 0 8px 0;">Practice</h3>
      <ul>
        ${lead.industry ? `<li><strong>Industry:</strong> ${escapeHtml(String(lead.industry))}</li>` : ''}
        ${lead.location ? `<li><strong>Location:</strong> ${escapeHtml(String(lead.location))}</li>` : ''}
        ${lead.incomeMix ? `<li><strong>Income mix:</strong> ${escapeHtml(String(lead.incomeMix))}</li>` : ''}
        ${lead.practiceType ? `<li><strong>Practice type:</strong> ${escapeHtml(String(lead.practiceType))}</li>` : ''}
        ${
          typeof lead.surgeriesCount === 'number'
            ? `<li><strong>Surgeries:</strong> ${escapeHtml(String(lead.surgeriesCount))}</li>`
            : ''
        }
        ${lead.tenure ? `<li><strong>Freehold/leasehold:</strong> ${escapeHtml(String(lead.tenure))}</li>` : ''}
        ${lead.readiness ? `<li><strong>Ready now/future:</strong> ${escapeHtml(String(lead.readiness))}</li>` : ''}
        ${lead.timeline ? `<li><strong>Timeline:</strong> ${escapeHtml(String(lead.timeline))}</li>` : ''}
        ${lead.revenueRange ? `<li><strong>Revenue range:</strong> ${escapeHtml(String(lead.revenueRange))}</li>` : ''}
        ${
          lead.earningsRange
            ? `<li><strong>Earnings range:</strong> ${escapeHtml(String(lead.earningsRange))}</li>`
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

  // Mark lead as notified (idempotency for retries/outbox).
  try {
    const supabase = getAdminSupabase();
    await supabase.from('leads').update({ notified_at: nowIso() }).eq('id', String(lead.id));
  } catch {
    // best-effort
  }

  return json(200, { ok: true, provider: 'resend', result: resendJson });
});

