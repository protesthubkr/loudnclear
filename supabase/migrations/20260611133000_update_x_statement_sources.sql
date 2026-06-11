insert into public.x_statement_sources (
  source_key,
  username,
  organization_name,
  source_url,
  enabled
)
values
  ('kwau38', 'kwau38', '여성연합', 'https://x.com/kwau38', true),
  (
    'rainbowactionkr',
    'rainbowactionkr',
    '무지개행동',
    'https://x.com/rainbowactionkr',
    true
  )
on conflict (source_key) do update
set
  enabled = excluded.enabled,
  organization_name = excluded.organization_name,
  source_url = excluded.source_url,
  username = excluded.username,
  updated_at = now();

update public.x_statement_sources
set
  enabled = false,
  last_error = null,
  updated_at = now()
where source_key = 'climatestrikekr';
