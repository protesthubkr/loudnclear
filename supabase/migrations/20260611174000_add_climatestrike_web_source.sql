insert into public.web_statement_sources (
  source_key,
  organization_name,
  source_url,
  list_url,
  enabled
)
values
  (
    'climatestrikekr',
    '기후위기비상',
    'http://climate-strike.kr/press/',
    'http://climate-strike.kr/feed/',
    true
  )
on conflict (source_key) do update
set
  enabled = excluded.enabled,
  list_url = excluded.list_url,
  organization_name = excluded.organization_name,
  source_url = excluded.source_url,
  updated_at = now();

update public.x_statement_sources
set
  enabled = false,
  last_error = null,
  updated_at = now()
where source_key = 'climatestrikekr';
