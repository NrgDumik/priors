'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Clock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  addHistoryNote,
  addKbq,
  addTrigger,
  deleteKbq,
  deleteThesis,
  deleteTrigger,
  updateKbq,
  updateThesis,
  updateTrigger,
} from '../actions';
import type {
  ActionResult,
  Confidence,
  FullThesis,
  KbqStatus,
  Verdict,
} from '@/lib/types';
import { CONFIDENCES, VERDICTS } from '@/lib/types';
import { daysSince, daysUntil, formatMoney } from '@/lib/thesis-utils';
import {
  Badge,
  CONF_COLORS,
  ConvictionDots,
  ErrorNote,
  STATUS_COLORS,
  ValuationBar,
} from '@/components/ui';

const NEXT_STATUS: Record<KbqStatus, KbqStatus> = {
  open: 'resolved-positive',
  'resolved-positive': 'resolved-negative',
  'resolved-negative': 'open',
};

export default function ThesisDetail({ t }: { t: FullThesis }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error);
      else onDone?.();
    });
  }

  const updatedDays = daysSince(t.updated_at);

  return (
    <div
      className={`pb-16 transition-opacity ${pending ? 'opacity-60' : 'opacity-100'}`}
    >
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/theses"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={15} aria-hidden /> Back
        </Link>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete this thesis"
            className="text-slate-600 hover:text-rose-400 p-1"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">
              Delete {t.ticker} and everything logged against it?
            </span>
            <button
              type="button"
              onClick={() =>
                run(
                  () => deleteThesis(t.id),
                  () => router.push('/theses')
                )
              }
              className="text-rose-400 hover:text-rose-300 font-medium"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-mono-data text-3xl font-semibold text-slate-100">
          {t.ticker}
        </h1>
        <select
          value={t.verdict}
          aria-label="Verdict"
          onChange={(e) =>
            run(() => updateThesis(t.id, { verdict: e.target.value as Verdict }))
          }
          className="bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-slate-500"
        >
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-slate-500 mb-1">{t.name}</p>
      <p className="text-[11px] text-slate-600 mb-5">
        {updatedDays === null
          ? 'Never updated'
          : updatedDays === 0
            ? 'Updated today'
            : `Last updated ${updatedDays}d ago`}
      </p>

      <div className="flex items-center gap-4 mb-6">
        <ConvictionDots value={t.conviction} />
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          defaultValue={t.conviction}
          aria-label="Conviction"
          onMouseUp={(e) =>
            run(() =>
              updateThesis(t.id, {
                conviction: parseFloat(e.currentTarget.value),
              })
            )
          }
          onTouchEnd={(e) =>
            run(() =>
              updateThesis(t.id, {
                conviction: parseFloat(e.currentTarget.value),
              })
            )
          }
          className="w-32 accent-amber-500"
        />
      </div>

      <EditableBlock
        label="Thesis"
        value={t.thesis}
        onSave={(v) => run(() => updateThesis(t.id, { thesis: v }))}
      />

      <EditableBlock
        label="Kill switch"
        hint="What would prove this wrong"
        accent
        value={t.kill_switch}
        onSave={(v) => run(() => updateThesis(t.id, { kill_switch: v }))}
      />

      <Section title="Valuation">
        <ValuationBar
          bear={t.val_bear}
          base={t.val_base}
          bull={t.val_bull}
          current={t.val_current}
          currency={t.currency}
        />
        <div className="grid grid-cols-4 gap-2 mt-2">
          {(
            [
              ['Bear', 'val_bear', t.val_bear],
              ['Base', 'val_base', t.val_base],
              ['Bull', 'val_bull', t.val_bull],
              ['Now', 'val_current', t.val_current],
            ] as const
          ).map(([label, field, value]) => (
            <label key={field} className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                {label}
              </span>
              <input
                type="number"
                step="any"
                defaultValue={value ?? ''}
                onBlur={(e) => {
                  const raw = e.currentTarget.value.trim();
                  const parsed = raw === '' ? null : Number(raw);
                  if (parsed !== null && Number.isNaN(parsed)) return;
                  if (parsed === value) return;
                  run(() => updateThesis(t.id, { [field]: parsed }));
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-500 focus:outline-none rounded-md px-2 py-1.5 text-sm text-slate-100 font-mono-data"
              />
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Key business questions"
        count={`${t.kbqs.filter((k) => k.status !== 'open').length}/${t.kbqs.length} resolved`}
      >
        <ul className="space-y-2">
          {t.kbqs.map((k) => (
            <li
              key={k.id}
              className="flex items-start gap-2 border border-slate-800 rounded-md px-3 py-2 bg-slate-950/40"
            >
              <button
                type="button"
                onClick={() =>
                  run(() =>
                    updateKbq(t.id, k.id, { status: NEXT_STATUS[k.status] })
                  )
                }
                title="Cycle status"
                className="shrink-0 mt-0.5"
              >
                <Badge className={STATUS_COLORS[k.status]}>
                  {k.status.replace('-', ' ')}
                </Badge>
              </button>
              <span className="text-sm text-slate-300 flex-1 leading-snug">
                {k.question}
              </span>
              <select
                value={k.confidence}
                aria-label="Confidence"
                onChange={(e) =>
                  run(() =>
                    updateKbq(t.id, k.id, {
                      confidence: e.target.value as Confidence,
                    })
                  )
                }
                className={`shrink-0 text-[11px] rounded-full border px-2 py-0.5 bg-transparent focus:outline-none ${CONF_COLORS[k.confidence]}`}
              >
                {CONFIDENCES.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => run(() => deleteKbq(t.id, k.id))}
                aria-label="Remove question"
                className="text-slate-700 hover:text-rose-400 shrink-0 mt-0.5"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
          {t.kbqs.length === 0 && (
            <li className="text-xs text-slate-600">
              No open questions. Add what you still need to find out.
            </li>
          )}
        </ul>
        <KbqAdder
          onAdd={(question, confidence) =>
            run(() => addKbq(t.id, question, confidence))
          }
        />
      </Section>

      <Section title="Triggers">
        <ul className="space-y-2">
          {t.triggers.map((tr) => {
            const days = daysUntil(tr.due_date);
            return (
              <li
                key={tr.id}
                className="flex items-center gap-2 border border-slate-800 rounded-md px-3 py-2 bg-slate-950/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    run(() => updateTrigger(t.id, tr.id, { done: !tr.done }))
                  }
                  aria-label={tr.done ? 'Mark as pending' : 'Mark as done'}
                  className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                    tr.done
                      ? 'bg-teal-500/20 border-teal-600 text-teal-300'
                      : 'border-slate-700 text-transparent hover:border-slate-500'
                  }`}
                >
                  <Check size={11} aria-hidden />
                </button>
                <span
                  className={`text-sm flex-1 ${tr.done ? 'text-slate-600 line-through' : 'text-slate-300'}`}
                >
                  {tr.description}
                </span>
                {tr.due_date && (
                  <span
                    className={`text-[11px] font-mono-data shrink-0 ${
                      !tr.done && days !== null && days <= 0
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    <Clock size={10} aria-hidden className="inline mr-1 -mt-px" />
                    {tr.due_date}
                    {!tr.done && days !== null && (
                      <> · {days <= 0 ? 'overdue' : `${days}d`}</>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => run(() => deleteTrigger(t.id, tr.id))}
                  aria-label="Remove trigger"
                  className="text-slate-700 hover:text-rose-400 shrink-0"
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            );
          })}
          {t.triggers.length === 0 && (
            <li className="text-xs text-slate-600">
              Nothing scheduled. Add the next event that could move this thesis.
            </li>
          )}
        </ul>
        <TriggerAdder
          onAdd={(description, date) =>
            run(() => addTrigger(t.id, description, date))
          }
        />
      </Section>

      <Section title="History">
        <NoteAdder onAdd={(note) => run(() => addHistoryNote(t.id, note))} />
        <ol className="space-y-3 mt-4">
          {t.history.map((h) => (
            <li key={h.id} className="border-l-2 border-slate-800 pl-3">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-mono-data text-slate-500">
                  {h.created_at.slice(0, 10)}
                </span>
                {h.source !== 'note' && (
                  <Badge className="text-slate-400 border-slate-700 bg-slate-800/60">
                    {h.source.replace('_', ' ')}
                  </Badge>
                )}
                {h.conviction_at_time !== null && (
                  <span className="text-[11px] font-mono-data text-slate-600">
                    conviction {h.conviction_at_time.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-snug">{h.note}</p>
              {h.source === 'report' && <ReportBody snapshot={h.snapshot} />}
            </li>
          ))}
          {t.history.length === 0 && (
            <li className="text-xs text-slate-600">Nothing logged yet.</li>
          )}
        </ol>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------

function ReportBody({
  snapshot,
}: {
  snapshot: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const md = snapshot && typeof snapshot['report_md'] === 'string'
    ? (snapshot['report_md'] as string)
    : null;
  if (!md) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-amber-500/90 hover:text-amber-400"
      >
        {open ? 'Hide full report' : 'Read full report'}
      </button>
      {open && (
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-md p-3 leading-relaxed">
          {md}
        </pre>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-800 rounded-lg p-4 mb-5 bg-slate-900/40">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          {title}
        </h2>
        {count && (
          <span className="text-[11px] font-mono-data text-slate-600">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function EditableBlock({
  label,
  hint,
  value,
  accent,
  onSave,
}: {
  label: string;
  hint?: string;
  value: string;
  accent?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <section
      className={`border rounded-lg p-4 mb-5 ${
        accent
          ? 'border-amber-900/50 bg-amber-950/10'
          : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h2
          className={`text-xs uppercase tracking-wider ${accent ? 'text-amber-600/90' : 'text-slate-500'}`}
        >
          {label}
        </h2>
        {hint && <span className="text-[11px] text-slate-600">{hint}</span>}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            autoFocus
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 focus:border-slate-500 focus:outline-none rounded-md px-3 py-2 text-sm text-slate-100 resize-y"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-medium rounded-md px-3 py-1.5"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="text-left w-full group flex items-start gap-2"
        >
          <p className="text-sm text-slate-200 leading-relaxed flex-1">
            {value}
          </p>
          <Pencil
            size={13}
            aria-hidden
            className="text-slate-600 group-hover:text-slate-400 mt-0.5 shrink-0"
          />
        </button>
      )}
    </section>
  );
}

function KbqAdder({
  onAdd,
}: {
  onAdd: (question: string, confidence: Confidence) => void;
}) {
  const [value, setValue] = useState('');
  const [confidence, setConfidence] = useState<Confidence>('Moderate');

  function submit() {
    if (value.trim().length < 8) return;
    onAdd(value, confidence);
    setValue('');
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="What still needs to be found out?"
        aria-label="New key business question"
        className="flex-1 bg-slate-950 border border-slate-800 focus:border-slate-500 focus:outline-none rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600"
      />
      <select
        value={confidence}
        aria-label="Confidence"
        onChange={(e) => setConfidence(e.target.value as Confidence)}
        className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
      >
        {CONFIDENCES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        aria-label="Add question"
        className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}

function TriggerAdder({
  onAdd,
}: {
  onAdd: (description: string, date: string | null) => void;
}) {
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');

  function submit() {
    if (desc.trim().length < 3) return;
    onAdd(desc, date || null);
    setDesc('');
    setDate('');
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Q3 earnings, FDA decision, contract renewal…"
        aria-label="New trigger"
        className="flex-1 bg-slate-950 border border-slate-800 focus:border-slate-500 focus:outline-none rounded-md px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600"
      />
      <input
        type="date"
        value={date}
        aria-label="Trigger date"
        onChange={(e) => setDate(e.target.value)}
        className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        aria-label="Add trigger"
        className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
      >
        <Plus size={14} aria-hidden />
      </button>
    </div>
  );
}

function NoteAdder({ onAdd }: { onAdd: (note: string) => void }) {
  const [note, setNote] = useState('');

  return (
    <div className="flex items-start gap-2">
      <textarea
        value={note}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Log what changed and why…"
        aria-label="New history note"
        className="flex-1 bg-slate-950 border border-slate-800 focus:border-slate-500 focus:outline-none rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-600 resize-y"
      />
      <button
        type="button"
        onClick={() => {
          if (!note.trim()) return;
          onAdd(note);
          setNote('');
        }}
        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md px-3 py-2"
      >
        Log
      </button>
    </div>
  );
}

