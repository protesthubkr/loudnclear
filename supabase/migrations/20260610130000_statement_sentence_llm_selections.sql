create table if not exists public.statement_sentence_llm_selections (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'party')),
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
    check (final_status in ('selected', 'rejected', 'failed')),
  selected_sentence_id text,
  selected_sentence text,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  selector_is_target_document boolean,
  selector_displayable boolean,
  selector_sentence_role text
    check (
      selector_sentence_role is null
      or selector_sentence_role in (
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
  selector_target_subject text,
  selector_stance_action text,
  selector_confidence integer check (
    selector_confidence is null or selector_confidence between 0 and 100
  ),
  selector_reason text,
  selector_model text,
  selector_prompt_version text not null,
  verifier_displayable boolean,
  verifier_sentence_role text
    check (
      verifier_sentence_role is null
      or verifier_sentence_role in (
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
  verifier_target_subject text,
  verifier_stance_action text,
  verifier_confidence integer check (
    verifier_confidence is null or verifier_confidence between 0 and 100
  ),
  verifier_reason text,
  verifier_model text,
  verifier_prompt_version text not null,
  raw_selector_output jsonb not null default '{}'::jsonb,
  raw_verifier_output jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    source_type,
    source_summary_id,
    selector_prompt_version,
    verifier_prompt_version
  )
);

create index if not exists statement_sentence_llm_selections_source_idx
  on public.statement_sentence_llm_selections (
    source_type,
    source_summary_id
  );

create index if not exists statement_sentence_llm_selections_status_idx
  on public.statement_sentence_llm_selections (
    final_status,
    display_at desc nulls last
  );

drop trigger if exists set_updated_at_statement_sentence_llm_selections
  on public.statement_sentence_llm_selections;
create trigger set_updated_at_statement_sentence_llm_selections
before update on public.statement_sentence_llm_selections
for each row execute function public.set_updated_at();

alter table public.statement_sentence_llm_selections enable row level security;
alter table public.statement_sentence_llm_selections force row level security;

revoke all on public.statement_sentence_llm_selections from anon, authenticated;
