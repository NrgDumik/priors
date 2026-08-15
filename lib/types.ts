export const VERDICTS = ['Watchlist', 'Buy', 'Hold', 'Avoid', 'Sold'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const CONFIDENCES = ['Low', 'Moderate', 'High'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const KBQ_STATUSES = [
  'open',
  'resolved-positive',
  'resolved-negative',
] as const;
export type KbqStatus = (typeof KBQ_STATUSES)[number];

export type ThesisRow = {
  id: string;
  user_id: string;
  ticker: string;
  name: string;
  currency: string;
  verdict: Verdict;
  conviction: number;
  thesis: string;
  kill_switch: string;
  val_bear: number | null;
  val_base: number | null;
  val_bull: number | null;
  val_current: number | null;
  created_at: string;
  updated_at: string;
};

export type KbqRow = {
  id: string;
  thesis_id: string;
  question: string;
  confidence: Confidence;
  status: KbqStatus;
  sort_order: number;
  created_at: string;
  /** Stamped by DB trigger when status leaves 'open'. Read-only. */
  resolved_at: string | null;
};

export type TriggerRow = {
  id: string;
  thesis_id: string;
  description: string;
  due_date: string | null;
  done: boolean;
  sort_order: number;
  created_at: string;
};

/**
 * `source` is the entry type: 'note' | 'research' | 'report'
 * | 'import_create' | 'import_overwrite'. Kept as a plain string because
 * the set will grow and an unknown value should render, not crash.
 */
export type HistoryRow = {
  id: string;
  thesis_id: string;
  note: string;
  source: string;
  snapshot: Record<string, unknown> | null;
  /** Stamped by DB trigger from the parent thesis. Read-only. */
  conviction_at_time: number | null;
  created_at: string;
};

/** A thesis plus its children, as rendered on the detail page. */
export type FullThesis = ThesisRow & {
  kbqs: KbqRow[];
  triggers: TriggerRow[];
  history: HistoryRow[];
};

/** A thesis plus only what the dashboard card needs. */
export type ThesisSummary = ThesisRow & {
  kbqs: Pick<KbqRow, 'id' | 'status'>[];
  triggers: Pick<TriggerRow, 'id' | 'description' | 'due_date' | 'done'>[];
};

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };
