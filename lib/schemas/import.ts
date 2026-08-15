import { z } from 'zod';
import { CONFIDENCES, KBQ_STATUSES, VERDICTS } from '@/lib/types';

/**
 * The contract between a research session and the database.
 *
 * Bump SCHEMA_VERSION whenever this shape changes, and update the
 * research template in docs/thesis-import-spec.md to match. The version
 * check is what stops a stale template from importing silently-wrong data.
 */
export const SCHEMA_VERSION = 1;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const trimmed = (min: number, label: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(min, `${label} is required`));

export const kbqInputSchema = z.object({
  question: trimmed(8, 'KBQ question'),
  confidence: z.enum(CONFIDENCES).default('Moderate'),
  status: z.enum(KBQ_STATUSES).default('open'),
});

export const triggerInputSchema = z.object({
  description: trimmed(3, 'Trigger description'),
  date: isoDate.nullable().default(null),
});

export const valuationInputSchema = z.object({
  bear: z.number().finite().nullable().default(null),
  base: z.number().finite().nullable().default(null),
  bull: z.number().finite().nullable().default(null),
  current_price: z.number().finite().nullable().default(null),
});

export const thesisImportSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION, {
      errorMap: () => ({
        message: `schema_version must be ${SCHEMA_VERSION}. Regenerate the file with the current template.`,
      }),
    }),
    ticker: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9.\-]{1,12}$/, 'Ticker looks wrong')),
    company: trimmed(2, 'Company name'),
    currency: z.string().trim().min(1).max(4).default('$'),
    researched_at: isoDate,
    thesis: z.object({
      one_liner: trimmed(20, 'Thesis'),
      // The whole point of the app. No kill switch, no import.
      kill_switch: trimmed(10, 'Kill switch'),
      verdict: z.enum(VERDICTS).default('Watchlist'),
      conviction: z
        .number()
        .min(1)
        .max(5)
        .multipleOf(0.5, 'Conviction moves in 0.5 steps'),
    }),
    valuation: valuationInputSchema.default({
      bear: null,
      base: null,
      bull: null,
      current_price: null,
    }),
    kbqs: z.array(kbqInputSchema).min(1, 'At least one KBQ').max(8),
    triggers: z.array(triggerInputSchema).max(8).default([]),
    summary: trimmed(20, 'Summary'),
  })
  .superRefine((val, ctx) => {
    const { bear, base, bull } = val.valuation;
    if (bear !== null && bull !== null && bear > bull) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valuation'],
        message: 'Bear case is above the bull case — check the anchors.',
      });
    }
    if (base !== null && bear !== null && bull !== null) {
      if (base < bear || base > bull) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['valuation', 'base'],
          message: 'Base case sits outside the bear–bull range.',
        });
      }
    }
  });

export type ThesisImport = z.infer<typeof thesisImportSchema>;

/** What actually gets handed to the import_thesis RPC. */
export type ImportPayload = ThesisImport & { report_md: string | null };

export type ParseResult =
  | { ok: true; data: ThesisImport }
  | { ok: false; issues: string[] };

/** Parse raw file text into a validated payload, with readable errors. */
export function parseThesisFile(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, issues: [`Not valid JSON — ${message}`] };
  }

  const parsed = thesisImportSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => {
        const where = i.path.join('.');
        return where ? `${where}: ${i.message}` : i.message;
      }),
    };
  }
  return { ok: true, data: parsed.data };
}
