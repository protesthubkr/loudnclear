# Statement Display Decision Pipeline

## Goal

`core_sentence` extraction is no longer the final public-feed decision. The
canonical public display text is produced by `statement_display_decisions`.

As of `statement_display_decision_v3_ac_judge`, the display decision step is an
A/C comparison system based on manual eval feedback.

## Current Design

```text
extracted summary row
-> display-decision source row loader
-> title/lead/body/clause candidates
-> one LLM A/C judge call
   A = title or lead based candidate
   C = conservative body candidate
-> deterministic postprocess
-> grounding and format validation
-> statement_display_decisions upsert
-> public feed reads selected display decisions for the current prompt version
```

The old `statement-sentence-selections` selector/verifier comparison path has
been removed from the app. `statement_display_decisions` is the only public
sentence decision layer.

## Selection Principles

The judge should choose the sentence that works best as a standalone feed
message.

- Prefer A when the title or lead already contains both the issue and the
  organization's stance.
- Do not penalize a long title merely because it is long. A long title is good
  when the length comes from real issue and stance information.
- Penalize title text when it is long because of document labels, speaker names,
  bylines, subtitles, or political flourish without enough context.
- Prefer C when body text explains the issue context and stance better than the
  title.
- A short and forceful demand can be selected even when the surrounding issue
  context is thin, as long as the demand target is concrete.
- Stance is judged contextually by the LLM, not by a word-count gate.
- The judge may choose a grounded span directly from the raw text snapshot when
  the generated candidate list is too coarse. In that case `selected_sentence_id`
  can be `null`, but the final text must still pass grounding validation.

## Postprocess

Final display text is cleaned deterministically after the judge chooses content.

The cleaner removes or normalizes:

- `[성명]`, `[논평]`, `[보도자료]`, `[브리핑]`
- `[이주희 원내대변인]` and other speaker/byline brackets
- `<소식>` and similar angle-bracket labels
- URLs and hashtags
- missing periods between joined Korean sentence endings
- missing terminal punctuation

The validator no longer rejects selected text merely because a rule-based stance
regex is weak. It still rejects or marks review when:

- subject or stance clarity is `missing`
- the selected role is non-displayable
- the final cleaned sentence is ungrounded in title/body/candidates
- postprocess residue remains
- the final text is too short, too long, URL-like, or an incomplete fragment

## Manual Run

```powershell
$headers = @{ Authorization = "Bearer $env:OPS_RUN_SECRET" }
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-display-decisions" -Headers $headers -ContentType 'application/json' -Body (@{ force = $true; windowHours = 168; limit = 100 } | ConvertTo-Json)
```

Use `force=true` when changing `STATEMENT_DISPLAY_DECISION_PROMPT_VERSION` or
when backfilling the public feed after prompt changes.
