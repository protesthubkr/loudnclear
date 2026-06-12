alter table public.statement_eval_manual_scores
  add column if not exists output_id uuid,
  add column if not exists is_winner boolean not null default false,
  add column if not exists issue_score integer check (issue_score is null or issue_score between 1 and 5),
  add column if not exists stance_score integer check (stance_score is null or stance_score between 1 and 5),
  add column if not exists composition_score integer check (
    composition_score is null or composition_score between 1 and 5
  ),
  add column if not exists cleansing_score integer check (
    cleansing_score is null or cleansing_score between 1 and 5
  ),
  add column if not exists feed_score integer check (feed_score is null or feed_score between 1 and 5),
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

with first_outputs as (
  select distinct on (run_id, item_id)
    id,
    run_id,
    item_id
  from public.statement_eval_outputs
  order by run_id, item_id, variant_key, variant_version
)
update public.statement_eval_manual_scores scores
set output_id = first_outputs.id
from first_outputs
where scores.output_id is null
  and scores.run_id = first_outputs.run_id
  and scores.item_id = first_outputs.item_id;

delete from public.statement_eval_manual_scores
where output_id is null;

alter table public.statement_eval_manual_scores
  alter column output_id set not null;

alter table public.statement_eval_manual_scores
  drop constraint if exists statement_eval_manual_scores_run_id_item_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'statement_eval_manual_scores_output_id_fkey'
      and conrelid = 'public.statement_eval_manual_scores'::regclass
  ) then
    alter table public.statement_eval_manual_scores
      add constraint statement_eval_manual_scores_output_id_fkey
      foreign key (output_id)
      references public.statement_eval_outputs(id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'statement_eval_manual_scores_run_item_output_key'
      and conrelid = 'public.statement_eval_manual_scores'::regclass
  ) then
    alter table public.statement_eval_manual_scores
      add constraint statement_eval_manual_scores_run_item_output_key
      unique (run_id, item_id, output_id);
  end if;
end $$;

drop index if exists public.statement_eval_manual_scores_run_idx;
create index statement_eval_manual_scores_run_idx
  on public.statement_eval_manual_scores (run_id, item_id, output_id);
