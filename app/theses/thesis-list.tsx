'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Clock } from 'lucide-react';
import type { ThesisSummary } from '@/lib/types';
import {
  attentionScore,
  daysSince,
  daysUntil,
  isStale,
  nextTrigger,
} from '@/lib/thesis-utils';
import {
  asymmetry,
  asymmetrySortKey,
  formatAsymmetry,
  formatPct,
  upsideSortKey,
  upsideToBase,
  PRICE_STALE_DAYS,
  type Anchors,
} from '@/lib/valuation';
import { Badge, ConvictionDots } from '@/components/ui';
import { updateThesis } from './actions';

type SortMode = 'attention' | 'conviction' | 'upside' | 'asymmetry' | 'az';

const SORTS: [SortMode, string][] = [
  ['attention', 'Attention'],
  ['conviction', 'Conviction'],
  ['upside', 'Upside'],
  ['asymmetry', 'Asymmetry'],
  ['az', 'A–Z'],
];

function anchorsOf(t: ThesisSummary): Anchors {
  return {
    bear: t.val_bear,
    base: t.val_base,
    bull: t.val_bull,
    current: t.val_current,
  };
}

export default function ThesisList({ theses }: { theses: ThesisSummary[] }) {
  const [sortMode, setSortMode] = useState<SortMode>('attention');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = theses.filter(
      (t) =>
        t.ticker.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
    switch (sortMode) {
      case 'attention':
        return [...list].sort((a, b) => attentionScore(b) - attentionScore(a));
      case 'conviction':
        return [...list].sort((a, b) => b.conviction - a.conviction);
      case 'upside':
        return [...list].sort(
          (a, b) => upsideSortKey(anchorsOf(b)) - upsideSortKey(anchorsOf(a))
        );
      case 'asymmetry':
        return [...list].sort(
          (a, b) =>
            asymmetrySortKey(anchorsOf(b)) - asymmetrySortKey(anchorsOf(a))
        );
      case 'az':
        return [...list].sort((a, b) => a.ticker.localeCompare(b.ticker));
    }
  }, [theses, sortMode, search]);

  return (
    <>
      <TickerTape theses={theses} />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <Search
            size={13}
            aria-hidden
            className="absolute left-2.5 top-2.5 text-slate-600"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search theses"
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-7 pr-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
          />
        </div>
        <div className="flex items-center gap-1 text-xs flex-wrap">
          {SORTS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortMode(key)}
              aria-pressed={sortMode === key}
              className={`px-2.5 py-1 rounded-full border transition-colors ${
                sortMode === key
                  ? 'border-slate-500 text-slate-100 bg-slate-800'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-lg">
          <p className="text-slate-400 text-sm mb-1">
            {theses.length === 0
              ? 'Nothing tracked yet.'
              : 'No thesis matches that search.'}
          </p>
          {theses.length === 0 && (
            <p className="text-slate-600 text-xs">
              Research a ticker, then{' '}
              <Link href="/import" className="text-amber-500 hover:underline">
                import the files
              </Link>{' '}
              to start tracking it.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((t) => (
          <ThesisCard key={t.id} t={t} />
        ))}
      </div>
    </>
  );
}

function TickerTape({ theses }: { theses: ThesisSummary[] }) {
  const items = theses
    .flatMap((t) =>
      t.triggers
        .filter((tr) => !tr.done && tr.due_date)
        .map((tr) => ({
          id: `${t.id}-${tr.id}`,
          thesisId: t.id,
          ticker: t.ticker,
          desc: tr.description,
          days: daysUntil(tr.due_date) ?? Number.POSITIVE_INFINITY,
        }))
    )
    .filter((it) => it.days <= 14)
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) return null;

  return (
    <div className="border border-slate-800 bg-slate-900/60 rounded-lg px-4 py-2.5 mb-6 overflow-x-auto">
      <div className="flex items-center gap-6 whitespace-nowrap font-mono-data text-xs">
        <span className="text-slate-500 uppercase tracking-wider text-[10px] shrink-0">
          Due now
        </span>
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/theses/${it.thesisId}`}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity shrink-0"
          >
            <span
              className={
                it.days <= 0
                  ? 'text-rose-400 font-semibold'
                  : 'text-amber-400 font-semibold'
              }
            >
              {it.ticker}
            </span>
            <span className="text-slate-400">{it.desc}</span>
            <span className={it.days <= 0 ? 'text-rose-500' : 'text-slate-500'}>
              {it.days <= 0 ? 'overdue' : `in ${it.days}d`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * The card is a plain div with the link stretched across it, rather than
 * a <Link> wrapping everything. An <input> nested inside an anchor is
 * invalid HTML and every click on it would navigate. Content sits above
 * the link with pointer-events disabled so clicks fall through to it,
 * and the price field re-enables them for itself alone.
 */
function ThesisCard({ t }: { t: ThesisSummary }) {
  const nt = nextTrigger(t);
  const ntDays = nt ? daysUntil(nt.due_date) : null;
  const openKbqs = t.kbqs.filter((k) => k.status === 'open').length;
  const totalKbqs = t.kbqs.length;

  const anchors = anchorsOf(t);
  const upside = upsideToBase(anchors);
  const asym = asymmetry(anchors);

  return (
    <div className="relative border border-slate-800 hover:border-slate-600 bg-slate-900/60 rounded-lg transition-colors group">
      <Link
        href={`/theses/${t.id}`}
        aria-label={`Open ${t.ticker} — ${t.name}`}
        className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      />

      <div className="relative p-4 pointer-events-none">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono-data text-base font-semibold text-slate-100">
                {t.ticker}
              </span>
              <Badge className="text-slate-300 border-slate-700 bg-slate-800/60">
                {t.verdict}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{t.name}</p>
          </div>
          <ChevronRight
            size={16}
            aria-hidden
            className="text-slate-600 group-hover:text-slate-400 mt-1 shrink-0"
          />
        </div>

        <p className="text-sm text-slate-300 leading-snug mb-3 line-clamp-2">
          {t.thesis}
        </p>

        <PriceRow
          id={t.id}
          currency={t.currency}
          current={t.val_current}
          base={t.val_base}
          priceUpdatedAt={t.price_updated_at}
          upside={upside}
          asymmetryLabel={formatAsymmetry(asym)}
          asymmetryKind={asym.kind}
        />

        <div className="flex items-center justify-between text-xs mt-3">
          <ConvictionDots value={t.conviction} />
          <span
            className={
              openKbqs > 0
                ? 'text-amber-400 font-mono-data'
                : 'text-slate-600 font-mono-data'
            }
          >
            {totalKbqs > 0
              ? `${totalKbqs - openKbqs}/${totalKbqs} KBQs resolved`
              : 'no KBQs yet'}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-xs">
          {nt && ntDays !== null ? (
            <span className={ntDays <= 0 ? 'text-rose-400' : 'text-slate-400'}>
              <Clock size={11} aria-hidden className="inline mr-1 -mt-px" />
              {nt.description} · {ntDays <= 0 ? 'overdue' : `${ntDays}d`}
            </span>
          ) : (
            <span className="text-slate-600">no trigger set</span>
          )}
          {isStale(t.updated_at) && (
            <span className="text-amber-500/80 text-[11px]">stale · revisit</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PriceRow({
  id,
  currency,
  current,
  base,
  priceUpdatedAt,
  upside,
  asymmetryLabel,
  asymmetryKind,
}: {
  id: string;
  currency: string;
  current: number | null;
  base: number | null;
  priceUpdatedAt: string | null;
  upside: number | null;
  asymmetryLabel: string;
  asymmetryKind: string;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(current === null ? '' : String(current));
  const [error, setError] = useState(false);

  const priceAge = daysSince(priceUpdatedAt);
  const priceIsStale = priceAge !== null && priceAge > PRICE_STALE_DAYS;

  function save() {
    const raw = draft.trim();
    const parsed = raw === '' ? null : Number(raw);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError(true);
      return;
    }
    setError(false);
    if (parsed === current) return;
    startTransition(async () => {
      const result = await updateThesis(id, { val_current: parsed });
      if (!result.ok) setError(true);
    });
  }

  const upsideTone =
    upside === null
      ? 'text-slate-600'
      : upside > 0
        ? 'text-teal-400'
        : 'text-rose-400';

  return (
    <div className="flex items-center gap-3 font-mono-data text-xs border-t border-slate-800/60 pt-2.5">
      <div className="pointer-events-auto flex items-baseline gap-0.5">
        <span className="text-slate-500">{currency}</span>
        <input
          value={draft}
          inputMode="decimal"
          aria-label="Current price"
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setDraft(current === null ? '' : String(current));
              e.currentTarget.blur();
            }
          }}
          placeholder="—"
          size={6}
          className={`w-14 bg-transparent border-b px-0.5 py-0.5 text-slate-100 placeholder-slate-700 focus:outline-none transition-colors ${
            error
              ? 'border-rose-500'
              : 'border-transparent hover:border-slate-700 focus:border-amber-500'
          } ${pending ? 'opacity-50' : ''}`}
        />
      </div>

      {base !== null && (
        <span className={upsideTone} title={`Base case ${currency}${base}`}>
          {formatPct(upside)}
        </span>
      )}

      {asymmetryKind !== 'unknown' && (
        <span
          className="text-slate-400"
          title="Reward to risk, bull vs bear anchors"
        >
          {asymmetryLabel}
        </span>
      )}

      {priceIsStale && (
        <span className="text-amber-600/80 ml-auto" title="Price may be out of date">
          {priceAge}d old
        </span>
      )}
    </div>
  );
}
