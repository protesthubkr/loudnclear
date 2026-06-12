create table if not exists public.statement_eval_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null default now(),
  source_type text
    check (
      source_type is null
      or source_type in ('telegram', 'party', 'web', 'x')
    ),
  summary_id uuid,
  item_limit integer not null default 20 check (item_limit > 0),
  variant_keys text[] not null default '{}'::text[],
  model text,
  reasoning_effort text,
  item_count integer not null default 0 check (item_count >= 0),
  output_count integer not null default 0 check (output_count >= 0),
  selected_output_count integer not null default 0 check (selected_output_count >= 0),
  failed_output_count integer not null default 0 check (failed_output_count >= 0),
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  estimated_total_tokens integer not null default 0 check (estimated_total_tokens >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.statement_eval_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.statement_eval_runs(id) on delete cascade,
  source_type text not null check (source_type in ('telegram', 'party', 'web', 'x')),
  source_summary_id uuid not null,
  source_key text not null,
  organization_name text not null,
  source_url text not null,
  title text,
  document_type text not null,
  display_at timestamptz,
  current_core_sentence text,
  current_display_sentence text,
  current_display_status text,
  current_display_prompt_version text,
  text_snapshot text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, source_type, source_summary_id)
);

create table if not exists public.statement_eval_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.statement_eval_runs(id) on delete cascade,
  item_id uuid not null references public.statement_eval_items(id) on delete cascade,
  variant_key text not null,
  variant_version text not null,
  model text,
  reasoning_effort text,
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  estimated_total_tokens integer not null default 0 check (estimated_total_tokens >= 0),
  final_status text not null
    check (final_status in ('selected', 'review_needed', 'rejected', 'failed')),
  summary_mode text
    check (
      summary_mode is null
      or summary_mode in ('single_span', 'issue_plus_stance', 'two_sentence')
    ),
  span_plan jsonb not null default '{}'::jsonb,
  candidate_snapshot jsonb not null default '[]'::jsonb,
  assembled_sentence text,
  cleansed_sentence text,
  issue_text text,
  stance_text text,
  issue_clarity text
    check (
      issue_clarity is null
      or issue_clarity in ('clear', 'implied', 'missing')
    ),
  stance_clarity text
    check (
      stance_clarity is null
      or stance_clarity in ('clear', 'weak', 'missing')
    ),
  extractive_ok boolean not null default false,
  cleansing_ok boolean not null default false,
  length_ok boolean not null default false,
  hard_gate_ok boolean not null default false,
  metadata_left boolean not null default false,
  stance_signal_count integer not null default 0 check (stance_signal_count >= 0),
  issue_signal_count integer not null default 0 check (issue_signal_count >= 0),
  failure_reason text,
  planner_reason text,
  raw_planner_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, item_id, variant_key, variant_version)
);

create table if not exists public.statement_eval_manual_scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.statement_eval_runs(id) on delete cascade,
  item_id uuid not null references public.statement_eval_items(id) on delete cascade,
  output_id uuid not null references public.statement_eval_outputs(id) on delete cascade,
  is_winner boolean not null default false,
  issue_score integer check (issue_score is null or issue_score between 1 and 5),
  stance_score integer check (stance_score is null or stance_score between 1 and 5),
  composition_score integer check (
    composition_score is null or composition_score between 1 and 5
  ),
  cleansing_score integer check (
    cleansing_score is null or cleansing_score between 1 and 5
  ),
  feed_score integer check (feed_score is null or feed_score between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, item_id, output_id)
);

create index if not exists statement_eval_runs_created_idx
  on public.statement_eval_runs (created_at desc);

create index if not exists statement_eval_items_run_idx
  on public.statement_eval_items (run_id, display_at desc nulls last);

create index if not exists statement_eval_outputs_item_idx
  on public.statement_eval_outputs (item_id, variant_key);

create index if not exists statement_eval_outputs_variant_idx
  on public.statement_eval_outputs (
    run_id,
    variant_key,
    final_status,
    hard_gate_ok
  );

create index if not exists statement_eval_manual_scores_run_idx
  on public.statement_eval_manual_scores (run_id, item_id, output_id);

create unique index if not exists statement_eval_manual_scores_one_winner_idx
  on public.statement_eval_manual_scores (run_id, item_id)
  where is_winner;

drop trigger if exists set_updated_at_statement_eval_runs
  on public.statement_eval_runs;
create trigger set_updated_at_statement_eval_runs
before update on public.statement_eval_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_statement_eval_manual_scores
  on public.statement_eval_manual_scores;
create trigger set_updated_at_statement_eval_manual_scores
before update on public.statement_eval_manual_scores
for each row execute function public.set_updated_at();

alter table public.statement_eval_runs enable row level security;
alter table public.statement_eval_items enable row level security;
alter table public.statement_eval_outputs enable row level security;
alter table public.statement_eval_manual_scores enable row level security;

alter table public.statement_eval_runs force row level security;
alter table public.statement_eval_items force row level security;
alter table public.statement_eval_outputs force row level security;
alter table public.statement_eval_manual_scores force row level security;

revoke all on public.statement_eval_runs from anon, authenticated;
revoke all on public.statement_eval_items from anon, authenticated;
revoke all on public.statement_eval_outputs from anon, authenticated;
revoke all on public.statement_eval_manual_scores from anon, authenticated;
