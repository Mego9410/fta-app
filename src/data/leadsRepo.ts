import { getDbHandle } from '@/src/data/db';
import type { Lead, LeadType } from '@/src/domain/types';

export type CreateLeadInput = Omit<Lead, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

function makeId() {
  return `lead_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const db = await getDbHandle();
  const lead: Lead = {
    id: input.id ?? makeId(),
    type: input.type,
    listingId: input.listingId ?? null,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    callbackWindow: input.callbackWindow ?? null,
    message: input.message ?? null,
    industry: input.industry ?? null,
    location: input.location ?? null,
    incomeMix: input.incomeMix ?? null,
    practiceType: input.practiceType ?? null,
    surgeriesCount: input.surgeriesCount ?? null,
    tenure: input.tenure ?? null,
    readiness: input.readiness ?? null,
    timeline: input.timeline ?? null,
    revenueRange: input.revenueRange ?? null,
    earningsRange: input.earningsRange ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  await db.runAsync(
    `INSERT INTO leads(
      id, type, listingId,
      name, email, phone, callbackWindow, message,
      industry, location, incomeMix, practiceType, surgeriesCount, tenure, readiness,
      timeline, revenueRange, earningsRange,
      createdAt
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lead.id,
      lead.type,
      lead.listingId ?? null,
      lead.name,
      lead.email ?? null,
      lead.phone ?? null,
      lead.callbackWindow ?? null,
      lead.message ?? null,
      lead.industry ?? null,
      lead.location ?? null,
      lead.incomeMix ?? null,
      lead.practiceType ?? null,
      lead.surgeriesCount ?? null,
      lead.tenure ?? null,
      lead.readiness ?? null,
      lead.timeline ?? null,
      lead.revenueRange ?? null,
      lead.earningsRange ?? null,
      lead.createdAt,
    ],
  );

  return lead;
}

export async function listLeads(type?: LeadType): Promise<Lead[]> {
  const db = await getDbHandle();
  const args: any[] = [];
  const where = type ? 'WHERE type = ?' : '';
  if (type) args.push(type);

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM leads ${where} ORDER BY createdAt DESC`,
    args,
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    listingId: r.listingId ?? null,
    name: r.name,
    email: r.email ?? null,
    phone: r.phone ?? null,
    callbackWindow: r.callbackWindow ?? null,
    message: r.message ?? null,
    industry: r.industry ?? null,
    location: r.location ?? null,
    incomeMix: r.incomeMix ?? null,
    practiceType: r.practiceType ?? null,
    surgeriesCount: typeof r.surgeriesCount === 'number' ? r.surgeriesCount : r.surgeriesCount ? Number(r.surgeriesCount) : null,
    tenure: r.tenure ?? null,
    readiness: r.readiness ?? null,
    timeline: r.timeline ?? null,
    revenueRange: r.revenueRange ?? null,
    earningsRange: r.earningsRange ?? null,
    createdAt: r.createdAt,
  }));
}

