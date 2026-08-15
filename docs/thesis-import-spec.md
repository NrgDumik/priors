# Priors import contract — schema_version 1

Paste the block below at the end of a ticker research session. It produces
the two files the Priors import screen expects.

The JSON is the machine contract; the markdown is for you. They are paired
by being uploaded together, so filenames don't matter — but
`TICKER.thesis.json` / `TICKER.report.md` keeps your downloads folder sane.

---

## Prompt block

> Produce two files for import into Priors.
>
> **File 1 — `{TICKER}.thesis.json`.** Raw JSON, no markdown fences, no
> commentary. Exactly this shape:
>
> ```json
> {
>   "schema_version": 1,
>   "ticker": "NVO",
>   "company": "Novo Nordisk A/S",
>   "currency": "$",
>   "researched_at": "2026-08-15",
>   "thesis": {
>     "one_liner": "Two sentences at most. What you believe and why it is not already priced.",
>     "kill_switch": "The single thing that would end this thesis. Specific and checkable.",
>     "verdict": "Watchlist",
>     "conviction": 3.5
>   },
>   "valuation": {
>     "bear": 0,
>     "base": 0,
>     "bull": 0,
>     "current_price": 0
>   },
>   "kbqs": [
>     { "question": "A specific, checkable open question that would move the thesis.", "confidence": "Low" }
>   ],
>   "triggers": [
>     { "description": "Q3 2026 results", "date": "2026-10-28" }
>   ],
>   "summary": "2-3 sentences describing the state of things today, written for a dated log entry."
> }
> ```
>
> Rules the importer enforces — a file that breaks one gets rejected:
>
> - `verdict` ∈ Watchlist | Buy | Hold | Avoid | Sold
> - `conviction` 1–5, in 0.5 steps
> - `confidence` ∈ Low | Moderate | High
> - `kill_switch` non-empty (≥10 chars). **No kill switch, no import.**
> - 1–8 `kbqs`, 0–8 `triggers`
> - `date` is `YYYY-MM-DD` or `null` — never a guess dressed as a fact
> - valuation numbers are plain numbers in the stock's own currency, or
>   `null` if not estimated; `bear ≤ base ≤ bull`
> - `researched_at` is today's date
>
> **File 2 — `{TICKER}.report.md`.** The full research report in markdown.
> Free-form; it gets stored verbatim as a history entry and is not parsed.

---

## Changing the contract

`schema_version` must match `SCHEMA_VERSION` in `lib/schemas/import.ts`.
When you change the shape:

1. bump `SCHEMA_VERSION`
2. update the Zod schema
3. update the RPC in a new migration if columns changed
4. update the prompt block above

The version check exists so a stale template fails loudly at import
instead of silently writing half a thesis.

## What happens on re-import

If the ticker already exists under your account:

1. the current thesis + KBQs + triggers are snapshotted into `history`
   as an `import_overwrite` event
2. the thesis row is overwritten
3. KBQs and triggers are **replaced**, not merged — any status you had
   set by hand is archived in the snapshot, not carried forward
4. `summary` is appended as a `research` history entry
5. the report markdown is appended as a `report` history entry

Point 3 is the one to keep in mind: hand-resolved KBQs reset to whatever
the new file says. That is intentional — a fresh research pass should
restate the open questions — but it means re-importing casually loses
manual state. The old state is recoverable from the history snapshot.
