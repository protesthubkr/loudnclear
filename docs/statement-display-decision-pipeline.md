# Statement Display Decision Pipeline

## Goal

`core_sentence` extraction is no longer the final public-feed decision. The
canonical public display text is produced by `statement_display_decisions`.

The display decision step reads the source row, title, full text snapshot, the
previous `core_sentence`, and deterministic sentence candidates. One LLM call
then compares:

- `sentence_only`: the selected source sentence is clear enough by itself.
- `label_plus_sentence`: the selected source sentence has the right stance, but
  needs a short grounded topic label to make the subject clear.
- `review_needed`: the row is probably relevant but not safe enough for direct
  display.
- `rejected`: the row should not appear in the feed.

## Pipeline

```text
extracted summary row
-> title/body candidates from existing candidate builder
-> full text context + previous core_sentence
-> single LLM display comparator
-> deterministic validation
-> statement_display_decisions upsert
-> public feed reads selected display decisions only
```

## Implementation Plan

1. Create `statement_display_decisions` with selected display text, comparison
   metadata, prompt version, validation status, and RLS locked to service role.
2. Reuse the existing source-row readers and candidate builder so candidate
   generation stays centralized.
3. Add a single comparator prompt that explicitly compares `sentence_only` and
   `label_plus_sentence`.
4. Give this final decision step its own model and reasoning effort env values:
   `OPENAI_STATEMENT_DISPLAY_DECISION_MODEL` and
   `OPENAI_STATEMENT_DISPLAY_DECISION_REASONING_EFFORT`.
5. Add `/api/ingest/statement-display-decisions` for cron and manual backfill.
6. Change the public feed to require
   `statement_display_decisions.final_status = 'selected'` for the current
   prompt version.

## Operating Notes

Manual dry run:

```powershell
$headers = @{ Authorization = "Bearer $env:OPS_RUN_SECRET" }
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-display-decisions" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; limit = 10 } | ConvertTo-Json)
```

Backfill from June 1, 2026:

```powershell
$since = [DateTimeOffset]'2026-06-01T00:00:00+09:00'
$windowHours = [Math]::Ceiling(([DateTimeOffset]::Now - $since).TotalHours)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-display-decisions" -Headers $headers -ContentType 'application/json' -Body (@{ force = $true; windowHours = $windowHours; limit = 500 } | ConvertTo-Json)
```

Production deployment needs the migration
`supabase/migrations/20260611200000_statement_display_decisions.sql` before the
public feed is switched live.
