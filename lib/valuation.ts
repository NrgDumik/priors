/**
 * Valuation maths for the dashboard cards.
 *
 * Every function tolerates missing anchors, because a thesis can be
 * imported with no valuation at all. The awkward cases are prices that
 * have moved outside the bear-bull range — the ratio is undefined there,
 * and silently showing a huge number would be worse than saying so.
 */

export type Anchors = {
  bear: number | null;
  base: number | null;
  bull: number | null;
  current: number | null;
};

export type Asymmetry =
  | { kind: 'ratio'; value: number; reward: number; risk: number }
  | { kind: 'below-bear' }
  | { kind: 'above-bull' }
  | { kind: 'unknown' };

/** Percentage move from the current price to the base case. */
export function upsideToBase(a: Anchors): number | null {
  if (a.current === null || a.base === null || a.current <= 0) return null;
  return ((a.base - a.current) / a.current) * 100;
}

/**
 * Reward-to-risk against the bull and bear anchors. A price below the
 * bear case has no measurable downside left, and one above the bull case
 * has no upside — both are reported rather than divided through.
 */
export function asymmetry(a: Anchors): Asymmetry {
  // A zero or negative price is bad data, not a quote below the bear
  // case — report it as unknown so it matches upsideToBase.
  if (a.current === null || a.current <= 0 || a.bear === null || a.bull === null) {
    return { kind: 'unknown' };
  }
  const reward = a.bull - a.current;
  const risk = a.current - a.bear;

  if (risk <= 0) return { kind: 'below-bear' };
  if (reward <= 0) return { kind: 'above-bull' };
  return { kind: 'ratio', value: reward / risk, reward, risk };
}

export function formatAsymmetry(a: Asymmetry): string {
  switch (a.kind) {
    case 'ratio':
      return `${a.value.toFixed(1)}:1`;
    case 'below-bear':
      return 'below bear';
    case 'above-bull':
      return 'above bull';
    case 'unknown':
      return '—';
  }
}

export function formatPct(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

/** Sort key for asymmetry. Undefined cases sink to the bottom. */
export function asymmetrySortKey(a: Anchors): number {
  const result = asymmetry(a);
  if (result.kind === 'ratio') return result.value;
  // A price under its bear case is the most asymmetric position there is,
  // so it ranks above any finite ratio rather than below.
  if (result.kind === 'below-bear') return Number.MAX_SAFE_INTEGER;
  return Number.NEGATIVE_INFINITY;
}

export function upsideSortKey(a: Anchors): number {
  return upsideToBase(a) ?? Number.NEGATIVE_INFINITY;
}

export const PRICE_STALE_DAYS = 30;
