revoke select on public.telegram_statement_summaries from anon, authenticated;
revoke select on public.party_statement_summaries from anon, authenticated;
revoke select on public.web_statement_summaries from anon, authenticated;
revoke select on public.x_statement_summaries from anon, authenticated;

drop policy if exists telegram_statement_summaries_public_read
  on public.telegram_statement_summaries;
drop policy if exists party_statement_summaries_public_read
  on public.party_statement_summaries;
drop policy if exists x_statement_summaries_public_read
  on public.x_statement_summaries;
drop policy if exists web_statement_summaries_public_read
  on public.web_statement_summaries;
