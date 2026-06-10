begin;

update public.party_statement_summaries
set
  topic_gate_status = 'matched',
  updated_at = now()
where topic_gate_status = 'manual_matched';

update public.party_statement_summaries
set
  matched_topic_id = null,
  topic_gate_status = 'unmatched',
  topic_match_confidence = null,
  topic_match_method = 'embedding',
  topic_matched_at = now(),
  updated_at = now()
where topic_gate_status = 'manual_hidden';

alter table public.party_statement_summaries
  drop constraint if exists party_statement_summaries_topic_gate_status_check;

alter table public.party_statement_summaries
  add constraint party_statement_summaries_topic_gate_status_check
  check (topic_gate_status in ('pending', 'matched', 'unmatched'));

alter table public.statement_topic_links
  drop constraint if exists statement_topic_links_matched_by_check;

alter table public.statement_topic_links
  add constraint statement_topic_links_matched_by_check
  check (matched_by = 'embedding');

drop index if exists public.party_statement_summaries_public_feed_idx;

create index party_statement_summaries_public_feed_idx
  on public.party_statement_summaries (published_at desc nulls last)
  where
    status = 'extracted'
    and core_sentence is not null
    and topic_gate_status = 'matched';

create or replace view public.public_statement_feed_items
with (security_invoker = true)
as
select
  'telegram'::text as source_type,
  id as source_summary_id,
  channel_username as source_key,
  organization_name,
  source_url,
  message_created_at as display_at,
  false as is_time_unknown,
  document_type,
  core_sentence,
  extraction_confidence,
  null::text as topic_gate_status,
  null::numeric(6, 5) as topic_match_confidence
from public.telegram_statement_summaries
where status = 'extracted' and core_sentence is not null
union all
select
  'party'::text as source_type,
  id as source_summary_id,
  source_key,
  organization_name,
  source_url,
  published_at as display_at,
  false as is_time_unknown,
  document_type,
  core_sentence,
  extraction_confidence,
  topic_gate_status,
  topic_match_confidence
from public.party_statement_summaries
where
  status = 'extracted'
  and core_sentence is not null
  and topic_gate_status = 'matched';

drop policy if exists party_statement_summaries_public_read
  on public.party_statement_summaries;

create policy party_statement_summaries_public_read
  on public.party_statement_summaries
  for select
  to anon, authenticated
  using (
    status = 'extracted'
    and core_sentence is not null
    and topic_gate_status = 'matched'
  );

commit;
