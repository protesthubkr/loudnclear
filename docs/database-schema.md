# 성명뭉 DB Schema

## 방향

성명뭉 v1 스키마는 현재 앱 코드와 호환되는 테이블명을 유지한다. 대신 protesthub의 집회, X, 방송 테이블은 제거하고 성명/논평 피드 운영에 필요한 테이블만 남긴다.

핵심 원칙:
- raw 수집, 핵심 문장 추출, topic gate, 공개 feed를 분리한다.
- 공개 anon 접근은 extracted + 공개 게이트를 통과한 row로 제한한다.
- 운영/수집/원문/임베딩 테이블은 service role만 접근한다고 가정한다.
- 자주 쓰는 공개 feed, extraction queue, topic matching 경로에는 partial index를 둔다.

## 적용 파일

- Canonical schema: [supabase/schema.sql](../supabase/schema.sql)
- Migration placeholder: [supabase/migrations/20260610000000_initial_schema.sql](../supabase/migrations/20260610000000_initial_schema.sql)

새 Supabase 프로젝트에는 `supabase/schema.sql` 전체를 먼저 적용한다.

## 테이블 구성

Telegram 수집:
- `telegram_channel_subscriptions`
- `telegram_statement_scan_runs`
- `telegram_statement_scan_states`
- `telegram_statement_messages`
- `telegram_statement_extraction_batches`
- `telegram_statement_summaries`

정당 사이트 수집:
- `party_statement_sources`
- `party_statement_documents`
- `party_statement_summaries`

토픽 게이트:
- `statement_topics`
- `statement_topic_embeddings`
- `statement_topic_links`

공개 읽기:
- `public_statement_feed_items`

## 공개 정책

현재 앱은 `telegram_statement_summaries`, `party_statement_summaries`를 직접 읽는다. 따라서 v1에서는 두 summary 테이블에만 anon select를 허용하고 RLS로 row를 제한한다.

- Telegram: `status = 'extracted' and core_sentence is not null`
- Party: `status = 'extracted' and core_sentence is not null and topic_gate_status = 'matched'`

장기적으로는 public feed query를 `public_statement_feed_items` view로 옮기고, summary table 직접 grant를 제거하는 것이 더 좋다.

## 인덱스 기준

주요 조회 경로:
- 공개 feed 최신순
- pending/queued extraction
- 최근 48-168시간 topic matching
- source별 정당 문서 upsert
- embedding cache lookup

이에 맞춰 full index보다 partial index를 우선 사용한다. 예를 들어 공개 feed는 extracted row만 인덱스에 포함한다.

## Vercel build 이슈와의 관계

Vercel build에서 `public.telegram_statement_summaries`가 없어서 `/` prerender가 실패한 경우, 이 schema를 적용하면 테이블 누락 문제는 해결된다.

다만 공개 피드는 런타임 데이터이므로, 앱 코드도 `/`를 dynamic rendering으로 전환하고 테이블 누락 시 빈 feed로 떨어지게 만드는 것이 안전하다.

## 다음 refactor 후보

v2에서는 다음 통합을 고려한다.

- `telegram_statement_messages`와 `party_statement_documents`를 `source_documents`로 통합
- `telegram_statement_summaries`와 `party_statement_summaries`를 `statement_extractions`로 통합
- public page는 `public_statement_feed_items` view만 조회
- source별 parser 설정을 `statement_sources.fetch_config` jsonb로 이동
