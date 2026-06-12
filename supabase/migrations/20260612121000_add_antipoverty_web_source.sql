insert into public.web_statement_sources (
  source_key,
  organization_name,
  source_url,
  list_url,
  enabled
)
values (
  'antipoverty',
  '빈곤사회연대',
  'http://antipoverty.kr/xe/announce',
  'http://antipoverty.kr/xe/announce',
  true
)
on conflict (source_key) do update
set
  enabled = excluded.enabled,
  list_url = excluded.list_url,
  organization_name = excluded.organization_name,
  source_url = excluded.source_url,
  updated_at = now();
