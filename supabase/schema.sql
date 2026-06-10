create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.telegram_channel_subscriptions (
  channel_username text primary key,
  channel_title text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'disabled')),
  statement_feed_enabled boolean not null default true,
  last_checked_message_id bigint,
  last_checked_message_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_channel_subscriptions_feed_idx
  on public.telegram_channel_subscriptions (
    status,
    statement_feed_enabled,
    channel_username
  );

create index if not exists telegram_channel_subscriptions_checked_idx
  on public.telegram_channel_subscriptions (
    last_checked_at asc nulls first,
    channel_username
  );

create table if not exists public.telegram_statement_scan_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  channels_seen integer not null default 0 check (channels_seen >= 0),
  messages_seen integer not null default 0 check (messages_seen >= 0),
  messages_written integer not null default 0 check (messages_written >= 0),
  candidates_created integer not null default 0 check (candidates_created >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists telegram_statement_scan_runs_started_idx
  on public.telegram_statement_scan_runs (started_at desc);

create table if not exists public.telegram_statement_scan_states (
  channel_username text primary key
    references public.telegram_channel_subscriptions(channel_username)
    on delete cascade,
  last_scanned_message_id bigint,
  last_scanned_message_at timestamptz,
  last_scanned_at timestamptz,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_statement_scan_states_scanned_idx
  on public.telegram_statement_scan_states (
    last_scanned_at asc nulls first,
    channel_username
  );

create table if not exists public.telegram_statement_messages (
  id uuid primary key default gen_random_uuid(),
  channel_username text not null
    references public.telegram_channel_subscriptions(channel_username)
    on delete cascade,
  message_id bigint not null,
  channel_title text not null,
  source_url text not null,
  message_created_at timestamptz,
  text_snapshot text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (channel_username, message_id)
);

create index if not exists telegram_statement_messages_created_idx
  on public.telegram_statement_messages (message_created_at desc nulls last);

create index if not exists telegram_statement_messages_channel_idx
  on public.telegram_statement_messages (channel_username, message_id desc);

create table if not exists public.telegram_statement_extraction_batches (
  id uuid primary key default gen_random_uuid(),
  openai_batch_id text unique,
  input_file_id text,
  output_file_id text,
  error_file_id text,
  status text not null default 'preparing'
    check (
      status in (
        'preparing',
        'submitted',
        'validating',
        'in_progress',
        'finalizing',
        'completed',
        'failed',
        'expired',
        'cancelling',
        'cancelled'
      )
    ),
  request_count integer not null default 0 check (request_count >= 0),
  rule_extracted_count integer not null default 0 check (rule_extracted_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists telegram_statement_extraction_batches_openai_idx
  on public.telegram_statement_extraction_batches (openai_batch_id)
  where openai_batch_id is not null;

create index if not exists telegram_statement_extraction_batches_status_idx
  on public.telegram_statement_extraction_batches (status, created_at desc);

create table if not exists public.telegram_statement_summaries (
  id uuid primary key default gen_random_uuid(),
  channel_username text not null
    references public.telegram_channel_subscriptions(channel_username)
    on delete cascade,
  message_id bigint not null,
  organization_name text not null,
  source_url text not null,
  message_created_at timestamptz,
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
    check (status in ('pending', 'queued', 'extracted', 'skipped', 'failed')),
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
  batch_id uuid references public.telegram_statement_extraction_batches(id)
    on delete set null,
  batch_custom_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_username, message_id),
  foreign key (channel_username, message_id)
    references public.telegram_statement_messages(channel_username, message_id)
    on delete cascade
);

create index if not exists telegram_statement_summaries_public_feed_idx
  on public.telegram_statement_summaries (message_created_at desc nulls last)
  where status = 'extracted' and core_sentence is not null;

create index if not exists telegram_statement_summaries_extraction_queue_idx
  on public.telegram_statement_summaries (status, created_at asc)
  where status in ('pending', 'queued', 'failed');

create index if not exists telegram_statement_summaries_batch_idx
  on public.telegram_statement_summaries (batch_id)
  where batch_id is not null;

create table if not exists public.party_statement_sources (
  source_key text primary key,
  organization_name text not null,
  list_url text not null,
  enabled boolean not null default true,
  last_scanned_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists party_statement_sources_enabled_idx
  on public.party_statement_sources (enabled, source_key);

insert into public.party_statement_sources (
  source_key,
  organization_name,
  list_url,
  enabled
)
values
  (
    'people_power_party',
    '국힘당',
    'https://www.peoplepowerparty.kr/news/comment',
    true
  ),
  (
    'theminjoo',
    '민주당',
    'https://theminjoo.kr/main/sub/news/list.php?brd=188',
    true
  ),
  (
    'reform_party',
    '개혁신당',
    'https://www.reformparty.kr/briefing',
    true
  )
on conflict (source_key) do update
set
  enabled = excluded.enabled,
  list_url = excluded.list_url,
  organization_name = excluded.organization_name,
  updated_at = now();

create table if not exists public.party_statement_documents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null
    references public.party_statement_sources(source_key)
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

create index if not exists party_statement_documents_published_idx
  on public.party_statement_documents (published_at desc nulls last);

create index if not exists party_statement_documents_source_idx
  on public.party_statement_documents (source_key, external_id);

create table if not exists public.statement_topics (
  id uuid primary key default gen_random_uuid(),
  topic_key text not null unique,
  title text not null,
  status text not null default 'confirmed'
    check (status in ('candidate', 'confirmed', 'expired', 'ignored')),
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  telegram_source_count integer not null default 0 check (telegram_source_count >= 0),
  telegram_message_count integer not null default 0 check (telegram_message_count >= 0),
  representative_summary_id uuid,
  representative_source_url text,
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions > 0),
  centroid_embedding jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists statement_topics_confirmed_window_idx
  on public.statement_topics (window_ended_at desc)
  where status = 'confirmed';

create table if not exists public.party_statement_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.party_statement_documents(id)
    on delete cascade,
  source_key text not null
    references public.party_statement_sources(source_key)
    on delete cascade,
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
  topic_gate_status text not null default 'pending'
    check (
      topic_gate_status in (
        'pending',
        'matched',
        'unmatched'
      )
    ),
  matched_topic_id uuid
    references public.statement_topics(id)
    on delete set null,
  topic_match_confidence numeric(6, 5),
  topic_match_method text,
  topic_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists party_statement_summaries_public_feed_idx
  on public.party_statement_summaries (published_at desc nulls last)
  where
    status = 'extracted'
    and core_sentence is not null
    and topic_gate_status = 'matched';

create index if not exists party_statement_summaries_topic_match_idx
  on public.party_statement_summaries (published_at desc nulls last)
  where status = 'extracted' and core_sentence is not null;

create index if not exists party_statement_summaries_source_idx
  on public.party_statement_summaries (source_key, published_at desc nulls last);

create index if not exists party_statement_summaries_gate_idx
  on public.party_statement_summaries (
    status,
    topic_gate_status,
    published_at desc nulls last
  );

create table if not exists public.statement_topic_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'party')),
  source_summary_id uuid not null,
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions > 0),
  content_hash text not null,
  embedding jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    source_type,
    source_summary_id,
    embedding_model,
    embedding_dimensions
  )
);

create index if not exists statement_topic_embeddings_source_idx
  on public.statement_topic_embeddings (source_type, source_summary_id);

create table if not exists public.statement_topic_links (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null
    references public.statement_topics(id)
    on delete cascade,
  source_type text not null check (source_type in ('telegram', 'party')),
  source_summary_id uuid not null,
  source_key text not null,
  source_url text not null,
  similarity numeric(6, 5) not null default 0,
  matched_by text not null default 'embedding'
    check (matched_by = 'embedding'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (topic_id, source_type, source_summary_id)
);

create index if not exists statement_topic_links_source_idx
  on public.statement_topic_links (source_type, source_summary_id);

create index if not exists statement_topic_links_topic_idx
  on public.statement_topic_links (topic_id, similarity desc);

create table if not exists public.statement_sentence_llm_selections (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'party')),
  source_summary_id uuid not null,
  source_key text not null,
  organization_name text not null,
  source_url text not null,
  title text,
  display_at timestamptz,
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
  current_status text not null,
  current_core_sentence text,
  current_extraction_confidence integer check (
    current_extraction_confidence is null
    or current_extraction_confidence between 0 and 100
  ),
  current_extraction_reason text,
  current_model text,
  final_status text not null
    constraint statement_sentence_llm_selections_final_status_check
    check (final_status in ('selected', 'rejected', 'review_needed', 'failed')),
  selected_sentence_id text,
  selected_sentence text,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  selector_is_target_document boolean,
  selector_displayable boolean,
  selector_sentence_role text
    check (
      selector_sentence_role is null
      or selector_sentence_role in (
        'demand',
        'condemnation',
        'criticism',
        'welcome',
        'concern',
        'pledge',
        'context',
        'notice',
        'tribute',
        'resource_intro'
      )
    ),
  selector_target_subject text,
  selector_stance_action text,
  selector_confidence integer check (
    selector_confidence is null or selector_confidence between 0 and 100
  ),
  selector_reason text,
  selector_model text,
  selector_prompt_version text not null,
  verifier_displayable boolean,
  verifier_sentence_role text
    check (
      verifier_sentence_role is null
      or verifier_sentence_role in (
        'demand',
        'condemnation',
        'criticism',
        'welcome',
        'concern',
        'pledge',
        'context',
        'notice',
        'tribute',
        'resource_intro'
      )
    ),
  verifier_target_subject text,
  verifier_stance_action text,
  verifier_confidence integer check (
    verifier_confidence is null or verifier_confidence between 0 and 100
  ),
  verifier_reason text,
  verifier_model text,
  verifier_prompt_version text not null,
  raw_selector_output jsonb not null default '{}'::jsonb,
  raw_verifier_output jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    source_type,
    source_summary_id,
    selector_prompt_version,
    verifier_prompt_version
  )
);

create index if not exists statement_sentence_llm_selections_source_idx
  on public.statement_sentence_llm_selections (
    source_type,
    source_summary_id
  );

create index if not exists statement_sentence_llm_selections_status_idx
  on public.statement_sentence_llm_selections (
    final_status,
    display_at desc nulls last
  );

drop trigger if exists set_updated_at_telegram_channel_subscriptions
  on public.telegram_channel_subscriptions;
create trigger set_updated_at_telegram_channel_subscriptions
before update on public.telegram_channel_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_telegram_statement_scan_states
  on public.telegram_statement_scan_states;
create trigger set_updated_at_telegram_statement_scan_states
before update on public.telegram_statement_scan_states
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_telegram_statement_extraction_batches
  on public.telegram_statement_extraction_batches;
create trigger set_updated_at_telegram_statement_extraction_batches
before update on public.telegram_statement_extraction_batches
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_party_statement_sources
  on public.party_statement_sources;
create trigger set_updated_at_party_statement_sources
before update on public.party_statement_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_party_statement_documents
  on public.party_statement_documents;
create trigger set_updated_at_party_statement_documents
before update on public.party_statement_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_statement_topics
  on public.statement_topics;
create trigger set_updated_at_statement_topics
before update on public.statement_topics
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_statement_topic_embeddings
  on public.statement_topic_embeddings;
create trigger set_updated_at_statement_topic_embeddings
before update on public.statement_topic_embeddings
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_statement_topic_links
  on public.statement_topic_links;
create trigger set_updated_at_statement_topic_links
before update on public.statement_topic_links
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_statement_sentence_llm_selections
  on public.statement_sentence_llm_selections;
create trigger set_updated_at_statement_sentence_llm_selections
before update on public.statement_sentence_llm_selections
for each row execute function public.set_updated_at();

alter table public.telegram_channel_subscriptions enable row level security;
alter table public.telegram_statement_scan_runs enable row level security;
alter table public.telegram_statement_scan_states enable row level security;
alter table public.telegram_statement_messages enable row level security;
alter table public.telegram_statement_extraction_batches enable row level security;
alter table public.telegram_statement_summaries enable row level security;
alter table public.party_statement_sources enable row level security;
alter table public.party_statement_documents enable row level security;
alter table public.party_statement_summaries enable row level security;
alter table public.statement_topic_embeddings enable row level security;
alter table public.statement_topics enable row level security;
alter table public.statement_topic_links enable row level security;
alter table public.statement_sentence_llm_selections enable row level security;

alter table public.telegram_channel_subscriptions force row level security;
alter table public.telegram_statement_scan_runs force row level security;
alter table public.telegram_statement_scan_states force row level security;
alter table public.telegram_statement_messages force row level security;
alter table public.telegram_statement_extraction_batches force row level security;
alter table public.telegram_statement_summaries force row level security;
alter table public.party_statement_sources force row level security;
alter table public.party_statement_documents force row level security;
alter table public.party_statement_summaries force row level security;
alter table public.statement_topic_embeddings force row level security;
alter table public.statement_topics force row level security;
alter table public.statement_topic_links force row level security;
alter table public.statement_sentence_llm_selections force row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.telegram_statement_summaries to anon, authenticated;
grant select on public.party_statement_summaries to anon, authenticated;

drop policy if exists telegram_statement_summaries_public_read
  on public.telegram_statement_summaries;
create policy telegram_statement_summaries_public_read
  on public.telegram_statement_summaries
  for select
  to anon, authenticated
  using (status = 'extracted' and core_sentence is not null);

drop policy if exists party_statement_summaries_public_read
  on public.party_statement_summaries;
create policy party_statement_summaries_public_read
  on public.party_statement_summaries
  for select
  to anon, authenticated
  using (
    status = 'extracted'
    and core_sentence is not null
    and topic_gate_status = 'matched'
  );
