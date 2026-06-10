do $$
declare
  constraint_record record;
begin
  if to_regclass('public.statement_sentence_llm_selections') is null then
    return;
  end if;

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.statement_sentence_llm_selections'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%final_status%'
  loop
    execute format(
      'alter table public.statement_sentence_llm_selections drop constraint %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table if exists public.statement_sentence_llm_selections
  add constraint statement_sentence_llm_selections_final_status_check
  check (final_status in ('selected', 'rejected', 'review_needed', 'failed'));
