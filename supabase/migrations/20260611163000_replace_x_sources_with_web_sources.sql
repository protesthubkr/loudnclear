insert into public.web_statement_sources (
  source_key,
  organization_name,
  source_url,
  list_url,
  enabled
)
values
  (
    'kfem',
    '환경운동연합',
    'https://www.kfem.or.kr/home',
    'https://kfem.or.kr/rss',
    true
  ),
  (
    'equalact',
    '차제연',
    'https://equalityact.kr/',
    'https://equalityact.kr/feed/',
    true
  ),
  (
    'kwau38',
    '여성연합',
    'https://women21.or.kr/statement/',
    'https://women21.or.kr/statement/',
    true
  ),
  (
    'rainbowactionkr',
    '무지개행동',
    'https://rainbowaction.kr/',
    'https://rainbowaction.kr/ajax/template/widget/board.cm?widgetCode=w202601155a82b9b5d5110&sectionCode=s20260115fbcb39d958649&menuCode=m20260106515334a453449&baseUrl=&back_url=/21&m=21',
    true
  ),
  (
    'climateall',
    '기후정의동맹',
    'https://www.climatejusticealliance.kr',
    'https://www.climatejusticealliance.kr',
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
where source_key in (
  'climatestrikekr',
  'equalact',
  'kfem',
  'kwau38',
  'rainbowactionkr'
);
