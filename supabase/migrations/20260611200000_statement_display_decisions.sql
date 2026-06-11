create table if not exists public.statement_display_decisions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'party', 'web', 'x')),
  source_summary_id uuid not null,
  source_key text not null,
  organization_name text not null,
  source_url text not null,
  title text,
  display_at timestamptz,
  document_type text not null default 'position'
    check (
      document_type in (
        'statement',
        'commentary',
        'position',
        'press_release',
        'press_conference',
        'condemnation',
        'welcome'
      )
    ),
  current_status text not null,
  current_core_sentence text,
  current_extraction_confidence integer check (
    current_extraction_confidence is null
    or current_extraction_confidence between 0 and 100
  ),
  current_extraction_reason text,
  current_model text,
  final_status text not null
    check (final_status in ('selected', 'review_needed', 'rejected', 'failed')),
  selected_mode text
    check (
      selected_mode is null
      or selected_mode in (
        'sentence_only',
        'label_plus_sentence',
        'review_needed',
        'rejected'
      )
    ),
  selected_sentence_id text,
  core_sentence text,
  topic_label text,
  display_sentence text,
  target_subject text,
  stance_action text,
  sentence_role text
    check (
      sentence_role is null
      or sentence_role in (
        'demand',
        'condemnation',
        'criticism',
        'welcome',
        'concern',
        'pledge',
        'context',
        'notice',
        'tribute',
        'resource_intro'
      )
    ),
  subject_clarity text
    check (
      subject_clarity is null
      or subject_clarity in ('clear', 'implied', 'missing')
    ),
  stance_clarity text
    check (
      stance_clarity is null
      or stance_clarity in ('clear', 'weak', 'missing')
    ),
  confidence integer check (
    confidence is null or confidence between 0 and 100
  ),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  comparator_model text,
  comparator_prompt_version text not null,
  comparator_reason text,
  raw_comparator_output jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    source_type,
    source_summary_id,
    comparator_prompt_version
  )
);

create index if not exists statement_display_decisions_source_idx
  on public.statement_display_decisions (
    source_type,
    source_summary_id
  );

create index if not exists statement_display_decisions_status_idx
  on public.statement_display_decisions (
    final_status,
    display_at desc nulls last
  );

create index if not exists statement_display_decisions_selected_idx
  on public.statement_display_decisions (
    source_type,
    source_summary_id
  )
  where final_status = 'selected';

drop trigger if exists set_updated_at_statement_display_decisions
  on public.statement_display_decisions;
create trigger set_updated_at_statement_display_decisions
before update on public.statement_display_decisions
for each row execute function public.set_updated_at();

alter table public.statement_display_decisions enable row level security;
alter table public.statement_display_decisions force row level security;

revoke all on public.statement_display_decisions from anon, authenticated;
