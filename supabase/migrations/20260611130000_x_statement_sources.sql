create table if not exists public.x_statement_sources (
  source_key text primary key,
  username text not null unique,
  x_user_id text unique,
  organization_name text not null,
  source_url text not null,
  profile_image_url text,
  enabled boolean not null default true,
  last_scanned_post_id text,
  last_scanned_post_at timestamptz,
  last_scanned_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists x_statement_sources_enabled_idx
  on public.x_statement_sources (enabled, source_key);

create index if not exists x_statement_sources_scanned_idx
  on public.x_statement_sources (
    last_scanned_at asc nulls first,
    source_key
  );

insert into public.x_statement_sources (
  source_key,
  username,
  organization_name,
  source_url,
  enabled
)
values
  ('kfem', 'kfem', '환경운동연합', 'https://x.com/kfem', true),
  ('equalact', 'equalact', '차제연', 'https://x.com/equalact', true),
  (
    'climatestrikekr',
    'climatestrikekr',
    '기후정의동맹',
    'https://x.com/climatestrikekr',
    true
  )
on conflict (source_key) do update
set
  enabled = excluded.enabled,
  organization_name = excluded.organization_name,
  source_url = excluded.source_url,
  username = excluded.username,
  updated_at = now();

create table if not exists public.x_statement_posts (
  id uuid primary key default gen_random_uuid(),
  source_key text not null
    references public.x_statement_sources(source_key)
    on delete cascade,
  x_post_id text not null,
  x_user_id text not null,
  author_username text not null,
  author_name text not null,
  source_url text not null,
  posted_at timestamptz,
  text_snapshot text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_key, x_post_id)
);

create index if not exists x_statement_posts_posted_idx
  on public.x_statement_posts (posted_at desc nulls last);

create index if not exists x_statement_posts_source_idx
  on public.x_statement_posts (source_key, x_post_id desc);

create table if not exists public.x_statement_summaries (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null
    references public.x_statement_posts(id)
    on delete cascade,
  source_key text not null
    references public.x_statement_sources(source_key)
    on delete cascade,
  x_post_id text not null,
  organization_name text not null,
  source_url text not null,
  posted_at timestamptz,
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
  core_sentence text,
  status text not null default 'pending'
    check (status in ('pending', 'extracted', 'skipped', 'failed')),
  detection_reason text[] not null default '{}',
  extraction_confidence integer check (
    extraction_confidence is null
    or extraction_confidence between 0 and 100
  ),
  extraction_reason text,
  core_sentence_start integer,
  core_sentence_end integer,
  model text,
  prompt_version text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id),
  unique (source_key, x_post_id)
);

create index if not exists x_statement_summaries_public_feed_idx
  on public.x_statement_summaries (posted_at desc nulls last)
  where status = 'extracted' and core_sentence is not null;

create index if not exists x_statement_summaries_extraction_queue_idx
  on public.x_statement_summaries (status, created_at asc)
  where status in ('pending', 'failed');

create index if not exists x_statement_summaries_source_idx
  on public.x_statement_summaries (source_key, posted_at desc nulls last);

create table if not exists public.x_statement_scan_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sources_seen integer not null default 0 check (sources_seen >= 0),
  posts_seen integer not null default 0 check (posts_seen >= 0),
  posts_written integer not null default 0 check (posts_written >= 0),
  candidates_created integer not null default 0 check (candidates_created >= 0),
  extracted integer not null default 0 check (extracted >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  failed integer not null default 0 check (failed >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists x_statement_scan_runs_started_idx
  on public.x_statement_scan_runs (started_at desc);

alter table if exists public.statement_topic_embeddings
  drop constraint if exists statement_topic_embeddings_source_type_check,
  add constraint statement_topic_embeddings_source_type_check
    check (source_type in ('telegram', 'party', 'x'));

alter table if exists public.statement_topic_links
  drop constraint if exists statement_topic_links_source_type_check,
  add constraint statement_topic_links_source_type_check
    check (source_type in ('telegram', 'party', 'x'));

alter table if exists public.statement_sentence_llm_selections
  drop constraint if exists statement_sentence_llm_selections_source_type_check,
  add constraint statement_sentence_llm_selections_source_type_check
    check (source_type in ('telegram', 'party', 'x'));

drop trigger if exists set_updated_at_x_statement_sources
  on public.x_statement_sources;
create trigger set_updated_at_x_statement_sources
before update on public.x_statement_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_x_statement_summaries
  on public.x_statement_summaries;
create trigger set_updated_at_x_statement_summaries
before update on public.x_statement_summaries
for each row execute function public.set_updated_at();

alter table public.x_statement_sources enable row level security;
alter table public.x_statement_posts enable row level security;
alter table public.x_statement_summaries enable row level security;
alter table public.x_statement_scan_runs enable row level security;

alter table public.x_statement_sources force row level security;
alter table public.x_statement_posts force row level security;
alter table public.x_statement_summaries force row level security;
alter table public.x_statement_scan_runs force row level security;

grant select on public.x_statement_summaries to anon, authenticated;

drop policy if exists x_statement_summaries_public_read
  on public.x_statement_summaries;
create policy x_statement_summaries_public_read
  on public.x_statement_summaries
  for select
  to anon, authenticated
  using (status = 'extracted' and core_sentence is not null);
