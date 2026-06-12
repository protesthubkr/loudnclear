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
  ('kfem', 'kfem', '환경운동연합', 'https://x.com/kfem', false),
  ('equalact', 'equalact', '차제연', 'https://x.com/equalact', false),
  ('kwau38', 'kwau38', '여성연합', 'https://x.com/kwau38', false),
  (
    'rainbowactionkr',
    'rainbowactionkr',
    '무지개행동',
    'https://x.com/rainbowactionkr',
    false
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
  ),
  (
    'climatestrikekr',
    '기후위기비상',
    'http://climate-strike.kr/press/',
    'http://climate-strike.kr/feed/',
    true
  ),
  (
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

create table if not exists public.statement_topic_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'party', 'web', 'x')),
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
  source_type text not null check (source_type in ('telegram', 'party', 'web', 'x')),
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

create table if not exists public.statement_display_decisions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('telegram', 'party', 'web', 'x')),
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
    check (final_status in ('selected', 'review_needed', 'rejected', 'failed')),
  selected_mode text
    check (
      selected_mode is null
      or selected_mode in (
        'sentence_only',
        'label_plus_sentence',
        'review_needed',
        'rejected'
      )
    ),
  selected_sentence_id text,
  core_sentence text,
  topic_label text,
  display_sentence text,
  target_subject text,
  stance_action text,
  sentence_role text
    check (
      sentence_role is null
      or sentence_role in (
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
  subject_clarity text
    check (
      subject_clarity is null
      or subject_clarity in ('clear', 'implied', 'missing')
    ),
  stance_clarity text
    check (
      stance_clarity is null
      or stance_clarity in ('clear', 'weak', 'missing')
    ),
  confidence integer check (
    confidence is null or confidence between 0 and 100
  ),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  comparator_model text,
  comparator_prompt_version text not null,
  comparator_reason text,
  raw_comparator_output jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    source_type,
    source_summary_id,
    comparator_prompt_version
  )
);

create index if not exists statement_display_decisions_source_idx
  on public.statement_display_decisions (
    source_type,
    source_summary_id
  );

create index if not exists statement_display_decisions_status_idx
  on public.statement_display_decisions (
    final_status,
    display_at desc nulls last
  );

create index if not exists statement_display_decisions_selected_idx
  on public.statement_display_decisions (
    source_type,
    source_summary_id
  )
  where final_status = 'selected';

create index if not exists statement_display_decisions_public_selected_idx
  on public.statement_display_decisions (
    source_type,
    comparator_prompt_version,
    source_summary_id
  )
  where final_status = 'selected';

create or replace function public.get_public_statement_feed_items(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer,
  p_party_threshold numeric,
  p_display_prompt_version text
)
returns table (
  source_type text,
  source_summary_id uuid,
  organization_name text,
  source_url text,
  document_type text,
  display_sentence text,
  message_created_at timestamptz,
  is_time_unknown boolean
)
language sql
stable
set search_path = public
as $$
  with public_items as (
    select
      'telegram'::text as source_type,
      summary.id as source_summary_id,
      summary.organization_name,
      summary.source_url,
      summary.document_type,
      decision.display_sentence,
      summary.message_created_at,
      false as is_time_unknown,
      summary.message_created_at as sort_at
    from public.telegram_statement_summaries summary
    join public.statement_display_decisions decision
      on decision.source_type = 'telegram'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.message_created_at is not null
      and (p_from is null or summary.message_created_at >= p_from)
      and (p_to is null or summary.message_created_at < p_to)

    union all

    select
      'web'::text as source_type,
      summary.id as source_summary_id,
      summary.organization_name,
      summary.source_url,
      summary.document_type,
      decision.display_sentence,
      summary.published_at as message_created_at,
      false as is_time_unknown,
      summary.published_at as sort_at
    from public.web_statement_summaries summary
    join public.web_statement_sources source
      on source.source_key = summary.source_key
      and source.enabled = true
    join public.statement_display_decisions decision
      on decision.source_type = 'web'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.published_at is not null
      and (p_from is null or summary.published_at >= p_from)
      and (p_to is null or summary.published_at < p_to)

    union all

    select
      'party'::text as source_type,
      summary.id as source_summary_id,
      summary.organization_name,
      summary.source_url,
      summary.document_type,
      decision.display_sentence,
      summary.published_at as message_created_at,
      (
        summary.published_at is null
        or to_char(summary.published_at at time zone 'Asia/Seoul', 'HH24:MI') = '00:00'
      ) as is_time_unknown,
      case
        when summary.published_at is not null
          and to_char(summary.published_at at time zone 'Asia/Seoul', 'HH24:MI') = '00:00'
        then (
          date_trunc('day', summary.published_at at time zone 'Asia/Seoul')
          + interval '1 day'
          - interval '1 millisecond'
        ) at time zone 'Asia/Seoul'
        else summary.published_at
      end as sort_at
    from public.party_statement_summaries summary
    join public.statement_display_decisions decision
      on decision.source_type = 'party'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.topic_gate_status = 'matched'
      and summary.topic_match_confidence >= p_party_threshold
      and summary.published_at is not null
      and (p_from is null or summary.published_at >= p_from)
      and (p_to is null or summary.published_at < p_to)
  )
  select
    source_type,
    source_summary_id,
    organization_name,
    source_url,
    document_type,
    display_sentence,
    message_created_at,
    is_time_unknown
  from public_items
  where display_sentence is not null
  order by sort_at desc nulls last, source_summary_id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

create or replace function public.has_public_statement_feed_items_before(
  p_before timestamptz,
  p_party_threshold numeric,
  p_display_prompt_version text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_before is not null and exists (
    select 1
    from public.telegram_statement_summaries summary
    join public.statement_display_decisions decision
      on decision.source_type = 'telegram'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.message_created_at is not null
      and summary.message_created_at < p_before

    union all

    select 1
    from public.web_statement_summaries summary
    join public.web_statement_sources source
      on source.source_key = summary.source_key
      and source.enabled = true
    join public.statement_display_decisions decision
      on decision.source_type = 'web'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.published_at is not null
      and summary.published_at < p_before

    union all

    select 1
    from public.party_statement_summaries summary
    join public.statement_display_decisions decision
      on decision.source_type = 'party'
      and decision.source_summary_id = summary.id
      and decision.final_status = 'selected'
      and decision.comparator_prompt_version = p_display_prompt_version
    where summary.status = 'extracted'
      and summary.core_sentence is not null
      and summary.topic_gate_status = 'matched'
      and summary.topic_match_confidence >= p_party_threshold
      and summary.published_at is not null
      and summary.published_at < p_before

    limit 1
  );
$$;

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

drop trigger if exists set_updated_at_statement_display_decisions
  on public.statement_display_decisions;
create trigger set_updated_at_statement_display_decisions
before update on public.statement_display_decisions
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
alter table public.x_statement_sources enable row level security;
alter table public.x_statement_posts enable row level security;
alter table public.x_statement_summaries enable row level security;
alter table public.x_statement_scan_runs enable row level security;
alter table public.web_statement_sources enable row level security;
alter table public.web_statement_documents enable row level security;
alter table public.web_statement_summaries enable row level security;
alter table public.statement_topic_embeddings enable row level security;
alter table public.statement_topics enable row level security;
alter table public.statement_topic_links enable row level security;
alter table public.statement_display_decisions enable row level security;

alter table public.telegram_channel_subscriptions force row level security;
alter table public.telegram_statement_scan_runs force row level security;
alter table public.telegram_statement_scan_states force row level security;
alter table public.telegram_statement_messages force row level security;
alter table public.telegram_statement_extraction_batches force row level security;
alter table public.telegram_statement_summaries force row level security;
alter table public.party_statement_sources force row level security;
alter table public.party_statement_documents force row level security;
alter table public.party_statement_summaries force row level security;
alter table public.x_statement_sources force row level security;
alter table public.x_statement_posts force row level security;
alter table public.x_statement_summaries force row level security;
alter table public.x_statement_scan_runs force row level security;
alter table public.web_statement_sources force row level security;
alter table public.web_statement_documents force row level security;
alter table public.web_statement_summaries force row level security;
alter table public.statement_topic_embeddings force row level security;
alter table public.statement_topics force row level security;
alter table public.statement_topic_links force row level security;
alter table public.statement_display_decisions force row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

drop policy if exists telegram_statement_summaries_public_read
  on public.telegram_statement_summaries;

drop policy if exists party_statement_summaries_public_read
  on public.party_statement_summaries;

drop policy if exists x_statement_summaries_public_read
  on public.x_statement_summaries;

drop policy if exists web_statement_summaries_public_read
  on public.web_statement_summaries;

-- Public statement feed rows are served through the Next.js API with the
-- service role key. Do not expose summary tables directly to anon clients.
