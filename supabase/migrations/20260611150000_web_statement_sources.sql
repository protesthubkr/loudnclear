create table if not exists public.web_statement_sources (
  source_key text primary key,
  organization_name text not null,
  source_url text not null,
  list_url text not null,
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_statement_sources_enabled_idx
  on public.web_statement_sources (enabled, source_key);

create index if not exists web_statement_sources_scanned_idx
  on public.web_statement_sources (
    last_scanned_at asc nulls first,
    source_key
  );

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
  )
on conflict (source_key) do update
set
  enabled = excluded.enabled,
  list_url = excluded.list_url,
  organization_name = excluded.organization_name,
  source_url = excluded.source_url,
  updated_at = now();

create table if not exists public.web_statement_documents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null
    references public.web_statement_sources(source_key)
    on delete cascade,
  external_id text not null,
  organization_name text not null,
  source_url text not null,
  title text not null,
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
  published_at timestamptz,
  text_snapshot text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, external_id)
);

create index if not exists web_statement_documents_published_idx
  on public.web_statement_documents (published_at desc nulls last);

create index if not exists web_statement_documents_source_idx
  on public.web_statement_documents (source_key, external_id);

create table if not exists public.web_statement_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.web_statement_documents(id)
    on delete cascade,
  source_key text not null
    references public.web_statement_sources(source_key)
    on delete cascade,
  external_id text not null,
  organization_name text not null,
  source_url text not null,
  title text not null,
  published_at timestamptz,
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
  unique (document_id),
  unique (source_key, external_id)
);

create index if not exists web_statement_summaries_public_feed_idx
  on public.web_statement_summaries (published_at desc nulls last)
  where status = 'extracted' and core_sentence is not null;

create index if not exists web_statement_summaries_extraction_queue_idx
  on public.web_statement_summaries (status, created_at asc)
  where status in ('pending', 'failed');

create index if not exists web_statement_summaries_source_idx
  on public.web_statement_summaries (source_key, published_at desc nulls last);

alter table if exists public.statement_topic_embeddings
  drop constraint if exists statement_topic_embeddings_source_type_check,
  add constraint statement_topic_embeddings_source_type_check
    check (source_type in ('telegram', 'party', 'web', 'x'));

alter table if exists public.statement_topic_links
  drop constraint if exists statement_topic_links_source_type_check,
  add constraint statement_topic_links_source_type_check
    check (source_type in ('telegram', 'party', 'web', 'x'));

alter table if exists public.statement_sentence_llm_selections
  drop constraint if exists statement_sentence_llm_selections_source_type_check,
  add constraint statement_sentence_llm_selections_source_type_check
    check (source_type in ('telegram', 'party', 'web', 'x'));

drop trigger if exists set_updated_at_web_statement_sources
  on public.web_statement_sources;
create trigger set_updated_at_web_statement_sources
before update on public.web_statement_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_web_statement_documents
  on public.web_statement_documents;
create trigger set_updated_at_web_statement_documents
before update on public.web_statement_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_web_statement_summaries
  on public.web_statement_summaries;
create trigger set_updated_at_web_statement_summaries
before update on public.web_statement_summaries
for each row execute function public.set_updated_at();

alter table public.web_statement_sources enable row level security;
alter table public.web_statement_documents enable row level security;
alter table public.web_statement_summaries enable row level security;

alter table public.web_statement_sources force row level security;
alter table public.web_statement_documents force row level security;
alter table public.web_statement_summaries force row level security;

grant select on public.web_statement_summaries to anon, authenticated;

drop policy if exists web_statement_summaries_public_read
  on public.web_statement_summaries;
create policy web_statement_summaries_public_read
  on public.web_statement_summaries
  for select
  to anon, authenticated
  using (status = 'extracted' and core_sentence is not null);
