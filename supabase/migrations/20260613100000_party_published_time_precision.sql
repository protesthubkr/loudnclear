alter table public.party_statement_documents
  add column if not exists published_at_precision text not null default 'unknown',
  add column if not exists published_at_time_source text not null default 'source';

alter table public.party_statement_summaries
  add column if not exists published_at_precision text not null default 'unknown',
  add column if not exists published_at_time_source text not null default 'source';

alter table public.party_statement_documents
  drop constraint if exists party_statement_documents_published_at_precision_check;

alter table public.party_statement_documents
  add constraint party_statement_documents_published_at_precision_check
  check (published_at_precision in ('unknown', 'date', 'hour', 'minute', 'second'));

alter table public.party_statement_documents
  drop constraint if exists party_statement_documents_published_at_time_source_check;

alter table public.party_statement_documents
  add constraint party_statement_documents_published_at_time_source_check
  check (published_at_time_source in ('source', 'collected'));

alter table public.party_statement_summaries
  drop constraint if exists party_statement_summaries_published_at_precision_check;

alter table public.party_statement_summaries
  add constraint party_statement_summaries_published_at_precision_check
  check (published_at_precision in ('unknown', 'date', 'hour', 'minute', 'second'));

alter table public.party_statement_summaries
  drop constraint if exists party_statement_summaries_published_at_time_source_check;

alter table public.party_statement_summaries
  add constraint party_statement_summaries_published_at_time_source_check
  check (published_at_time_source in ('source', 'collected'));

update public.party_statement_documents
set published_at_precision = case
  when published_at is null then 'unknown'
  when to_char(published_at at time zone 'Asia/Seoul', 'HH24:MI') = '00:00' then 'date'
  else 'minute'
end
where published_at_precision = 'unknown';

update public.party_statement_summaries
set published_at_precision = case
  when published_at is null then 'unknown'
  when to_char(published_at at time zone 'Asia/Seoul', 'HH24:MI') = '00:00' then 'date'
  else 'minute'
end
where published_at_precision = 'unknown';

create or replace function public.get_public_statement_feed_items(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer,
  p_party_threshold numeric,
  p_display_prompt_version text
)
returns table (
  source_type text,
  source_summary_id uuid,
  organization_name text,
  source_url text,
  document_type text,
  display_sentence text,
  message_created_at timestamptz,
  is_time_unknown boolean
)
language sql
stable
set search_path = public
as $$
  with public_items as (
    select
      'telegram'::text as source_type,
      summary.id as source_summary_id,
      summary.organization_name,
      summary.source_url,
      summary.document_type,
      decision.display_sentence,
      summary.message_created_at,
      false as is_time_unknown,
      summary.message_created_at as sort_at
    from public.telegram_statement_summaries summary
    join public.statement_display_decisions decision
      on decision.source_type = 'telegram'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.message_created_at is not null
      and (p_from is null or summary.message_created_at >= p_from)
      and (p_to is null or summary.message_created_at < p_to)

    union all

    select
      'web'::text as source_type,
      summary.id as source_summary_id,
      summary.organization_name,
      summary.source_url,
      summary.document_type,
      decision.display_sentence,
      summary.published_at as message_created_at,
      false as is_time_unknown,
      summary.published_at as sort_at
    from public.web_statement_summaries summary
    join public.web_statement_sources source
      on source.source_key = summary.source_key
      and source.enabled = true
    join public.statement_display_decisions decision
      on decision.source_type = 'web'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.published_at is not null
      and (p_from is null or summary.published_at >= p_from)
      and (p_to is null or summary.published_at < p_to)

    union all

    select
      'party'::text as source_type,
      summary.id as source_summary_id,
      summary.organization_name,
      summary.source_url,
      summary.document_type,
      decision.display_sentence,
      summary.published_at as message_created_at,
      (
        summary.published_at is null
        or summary.published_at_precision in ('unknown', 'date')
      ) as is_time_unknown,
      case
        when summary.published_at is not null
          and summary.published_at_precision in ('unknown', 'date')
        then (
          date_trunc('day', summary.published_at at time zone 'Asia/Seoul')
          + interval '1 day'
          - interval '1 millisecond'
        ) at time zone 'Asia/Seoul'
        else summary.published_at
      end as sort_at
    from public.party_statement_summaries summary
    join public.statement_display_decisions decision
      on decision.source_type = 'party'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.topic_gate_status = 'matched'
      and summary.topic_match_confidence >= p_party_threshold
      and summary.published_at is not null
      and (p_from is null or summary.published_at >= p_from)
      and (p_to is null or summary.published_at < p_to)
  )
  select
    source_type,
    source_summary_id,
    organization_name,
    source_url,
    document_type,
    display_sentence,
    message_created_at,
    is_time_unknown
  from public_items
  where display_sentence is not null
  order by sort_at desc nulls last, source_summary_id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;
