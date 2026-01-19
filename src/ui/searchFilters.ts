import type React from 'react';

export const PROPERTY_TYPE_OPTIONS = ['Leasehold', 'Freehold', 'Virtual Freehold'] as const;
export const INCOME_TYPE_OPTIONS = ['NHS', 'Private', 'Mixed'] as const;

export function toggleSet(
  current: Set<string>,
  set: React.Dispatch<React.SetStateAction<Set<string>>>,
  value: string,
) {
  set((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

export function getSurgeriesCountFromTags(tags: string[] | undefined | null): number | null {
  const list = Array.isArray(tags) ? tags : [];
  const tag = list.find((t) => /\bSurger(?:y|ies)\b/i.test(t));
  if (!tag) return null;
  const m = tag.match(/(\d+)\s+Surger/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
