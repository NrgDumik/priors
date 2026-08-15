import { Star } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Confidence, KbqStatus } from '@/lib/types';
import { formatMoney } from '@/lib/thesis-utils';

export const CONF_COLORS: Record<Confidence, string> = {
  Low: 'text-rose-300 bg-rose-950/50 border-rose-800/60',
  Moderate: 'text-amber-300 bg-amber-950/50 border-amber-800/60',
  High: 'text-teal-300 bg-teal-950/50 border-teal-800/60',
};

export const STATUS_COLORS: Record<KbqStatus, string> = {
  open: 'text-amber-300 bg-amber-950/50 border-amber-800/60',
  'resolved-positive': 'text-teal-300 bg-teal-950/50 border-teal-800/60',
  'resolved-negative': 'text-rose-300 bg-rose-950/50 border-rose-800/60',
};

export function Badge({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full border font-medium tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

export function ConvictionDots({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          aria-hidden
          className={
            i <= rounded ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
          }
        />
      ))}
      <span className="text-xs text-slate-500 font-mono-data ml-1">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

type Mark = { label: string; value: number; color: string };

export function ValuationBar({
  bear,
  base,
  bull,
  current,
  currency = '$',
}: {
  bear: number | null;
  base: number | null;
  bull: number | null;
  current: number | null;
  currency?: string;
}) {
  const nums = [bear, base, bull, current].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n)
  );
  if (nums.length < 2) {
    return (
      <p className="text-xs text-slate-500 italic">
        Add bear / base / bull anchors to see the range.
      </p>
    );
  }

  const min = Math.min(...nums) * 0.95;
  const max = Math.max(...nums) * 1.05;
  const span = max - min || 1;
  const pct = (n: number) => ((n - min) / span) * 100;

  const marks: Mark[] = (
    [
      { label: 'Bear', value: bear, color: 'bg-rose-400' },
      { label: 'Base', value: base, color: 'bg-slate-300' },
      { label: 'Bull', value: bull, color: 'bg-teal-400' },
    ] as { label: string; value: number | null; color: string }[]
  ).filter((m): m is Mark => typeof m.value === 'number');

  return (
    <div className="pt-1 pb-3">
      <div className="relative h-1.5 rounded-full bg-slate-800 mt-6 mb-1">
        {marks.map((m) => (
          <div
            key={m.label}
            className="absolute -top-6 flex flex-col items-center"
            style={{ left: `${pct(m.value)}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-[10px] text-slate-400 mb-1 font-mono-data whitespace-nowrap">
              {m.label} {formatMoney(m.value, currency)}
            </span>
            <div className={`w-2 h-2 rounded-full ${m.color}`} />
          </div>
        ))}
        {typeof current === 'number' && Number.isFinite(current) && (
          <div
            className="absolute -bottom-5 flex flex-col items-center"
            style={{ left: `${pct(current)}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-4 bg-slate-200 -mt-1" />
            <span className="text-[10px] text-slate-200 font-mono-data mt-0.5 whitespace-nowrap">
              now {formatMoney(current, currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-md px-3 py-2"
    >
      {children}
    </p>
  );
}
