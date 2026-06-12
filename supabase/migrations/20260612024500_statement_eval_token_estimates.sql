alter table public.statement_eval_runs
  add column if not exists estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  add column if not exists estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  add column if not exists estimated_total_tokens integer not null default 0 check (estimated_total_tokens >= 0);

alter table public.statement_eval_outputs
  add column if not exists estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  add column if not exists estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  add column if not exists estimated_total_tokens integer not null default 0 check (estimated_total_tokens >= 0);
