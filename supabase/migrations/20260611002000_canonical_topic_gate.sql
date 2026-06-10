begin;

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
