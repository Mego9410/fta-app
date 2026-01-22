import { getDbHandle } from '@/src/data/db';
import { isSupabaseConfigured, requireSupabase } from '@/src/supabase/client';

type OutboxType = 'lead_insert' | 'email_inquiry' | 'email_seller';

type OutboxRow = {
  id: string;
  type: OutboxType;
  payloadJson: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
};

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function backoffMs(attempts: number) {
  // 30s, 60s, 120s, ... max 24h
  const base = 30_000;
  const n = Math.max(0, Math.min(16, attempts));
  return Math.min(24 * 60 * 60 * 1000, base * Math.pow(2, n));
}

export async function enqueueOutbox(type: OutboxType, payload: unknown): Promise<string> {
  const db = await getDbHandle();
  const id = makeId('outbox');
  await db.runAsync(
    `INSERT INTO outbox(id, type, payloadJson, attempts, lastError, nextAttemptAt, createdAt)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [id, type, JSON.stringify(payload ?? {}), 0, null, null, nowIso()],
  );
  return id;
}

async function listDue(limit = 25): Promise<OutboxRow[]> {
  const db = await getDbHandle();
  const now = nowIso();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM outbox
     WHERE nextAttemptAt IS NULL OR nextAttemptAt <= ?
     ORDER BY createdAt ASC
     LIMIT ?`,
    [now, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payloadJson: r.payloadJson,
    attempts: typeof r.attempts === 'number' ? r.attempts : Number(r.attempts ?? 0),
    lastError: r.lastError ?? null,
    nextAttemptAt: r.nextAttemptAt ?? null,
    createdAt: r.createdAt,
  }));
}

async function remove(id: string) {
  const db = await getDbHandle();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

async function markFailure(id: string, attempts: number, err: string) {
  const db = await getDbHandle();
  const next = new Date(Date.now() + backoffMs(attempts)).toISOString();
  await db.runAsync('UPDATE outbox SET attempts = ?, lastError = ?, nextAttemptAt = ? WHERE id = ?', [
    attempts,
    err,
    next,
    id,
  ]);
}

async function processRow(row: OutboxRow) {
  const supabase = requireSupabase();
  let payload: any = {};
  try {
    payload = JSON.parse(row.payloadJson);
  } catch {
    payload = {};
  }

  if (row.type === 'lead_insert') {
    const lead = payload?.lead ?? null;
    const intendedUserId = typeof payload?.userId === 'string' ? payload.userId : null;
    if (!lead?.id || !lead?.type || !lead?.name) throw new Error('Invalid lead payload');

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const currentUserId = session?.user?.id ?? null;
    const userIdForInsert = currentUserId && intendedUserId && currentUserId === intendedUserId ? currentUserId : null;

    const { error } = await supabase.from('leads').insert({
      id: String(lead.id),
      type: String(lead.type),
      listing_id: lead.listingId ?? null,
      user_id: userIdForInsert,
      name: String(lead.name),
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      callback_window: lead.callbackWindow ?? null,
      message: lead.message ?? null,
      industry: lead.industry ?? null,
      location: lead.location ?? null,
      income_mix: lead.incomeMix ?? null,
      practice_type: lead.practiceType ?? null,
      surgeries_count: lead.surgeriesCount ?? null,
      tenure: lead.tenure ?? null,
      readiness: lead.readiness ?? null,
      timeline: lead.timeline ?? null,
      revenue_range: lead.revenueRange ?? null,
      earnings_range: lead.earningsRange ?? null,
      created_at: lead.createdAt ?? nowIso(),
    });
    if (error) throw error;
    return;
  }

  if (row.type === 'email_inquiry') {
    const res = await supabase.functions.invoke('inquiry-email', { body: payload ?? {} });
    if (res.error) throw new Error(res.error.message);
    return;
  }

  if (row.type === 'email_seller') {
    const res = await supabase.functions.invoke('seller-intake-email', { body: payload ?? {} });
    if (res.error) throw new Error(res.error.message);
    return;
  }

  throw new Error(`Unknown outbox type: ${row.type as string}`);
}

export async function flushOutbox(options?: { limit?: number }) {
  if (!isSupabaseConfigured) return { processed: 0, succeeded: 0, failed: 0 };
  const limit = options?.limit ?? 25;

  const due = await listDue(limit);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const row of due) {
    processed += 1;
    try {
      await processRow(row);
      await remove(row.id);
      succeeded += 1;
    } catch (e: any) {
      failed += 1;
      const nextAttempts = (row.attempts ?? 0) + 1;
      await markFailure(row.id, nextAttempts, e?.message ?? String(e));
    }
  }

  return { processed, succeeded, failed };
}

