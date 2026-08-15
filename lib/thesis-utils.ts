import type { ThesisSummary } from '@/lib/types';

/** Days from today until an ISO date. Negative means overdue. */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/** Days elapsed since an ISO timestamp. */
export function daysSince(isoDateTime: string | null): number | null {
  if (!isoDateTime) return null;
  const then = new Date(isoDateTime);
  if (Number.isNaN(then.getTime())) return null;
  return Math.round((Date.now() - then.getTime()) / 86_400_000);
}

export const STALE_AFTER_DAYS = 60;

export function isStale(updatedAt: string): boolean {
  const d = daysSince(updatedAt);
  return d !== null && d > STALE_AFTER_DAYS;
}

/**
 * Ranks what deserves your attention: overdue triggers dominate, then
 * imminent ones, then unresolved questions, then plain staleness.
 */
export function attentionScore(t: ThesisSummary): number {
  const openKbqs = t.kbqs.filter((k) => k.status === 'open').length;

  let overdue = 0;
  let soon = 0;
  for (const trigger of t.triggers) {
    if (trigger.done) continue;
    const d = daysUntil(trigger.due_date);
    if (d === null) continue;
    if (d <= 0) overdue += 1;
    else if (d <= 14) soon += 1;
  }

  return openKbqs * 2 + overdue * 6 + soon * 3 + (isStale(t.updated_at) ? 1 : 0);
}

export function nextTrigger(
  t: ThesisSummary
): ThesisSummary['triggers'][number] | null {
  const dated = t.triggers.filter((tr) => !tr.done && tr.due_date);
  if (dated.length === 0) return null;
  return [...dated].sort((a, b) =>
    String(a.due_date).localeCompare(String(b.due_date))
  )[0]!;
}

export function formatMoney(
  value: number | null | undefined,
  currency: string
): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 0 : abs >= 1 ? 2 : 3;
  return `${currency}${value.toFixed(decimals)}`;
}
