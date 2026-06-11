# 성명뭉 DB Schema

## 방향

성명뭉 v1 스키마는 현재 앱 코드와 호환되는 테이블명을 유지한다. 대신 protesthub의 집회, 방송 테이블은 제거하고 성명/논평 피드 운영에 필요한 테이블만 남긴다. X 테이블은 과거 수집 기록과 수동 점검용으로 남기지만, 자동 수집과 공개/토픽 입력에는 사용하지 않는다.

핵심 원칙:
- raw 수집, 핵심 문장 추출, topic gate, 공개 feed를 분리한다.
- 공개 anon 접근은 extracted + 공개 게이트를 통과한 row로 제한한다.
- 운영/수집/원문/임베딩 테이블은 service role만 접근한다고 가정한다.
- 자주 쓰는 공개 feed, extraction queue, topic matching 경로에는 partial index를 둔다.

## 적용 파일

- Canonical schema: [supabase/schema.sql](../supabase/schema.sql)
- Incremental migrations: [supabase/migrations](../supabase/migrations)

새 Supabase 프로젝트에는 `supabase/schema.sql` 전체를 먼저 적용한다.

## 테이블 구성

Telegram 수집:
- `telegram_channel_subscriptions`
- `telegram_statement_scan_runs`
- `telegram_statement_scan_states`
- `telegram_statement_messages`
- `telegram_statement_extraction_batches`
- `telegram_statement_summaries`

X 기록 보존:
- `x_statement_sources`
- `x_statement_posts`
- `x_statement_summaries`
- `x_statement_scan_runs`

confirmed topic 형성 웹사이트 수집:
- `web_statement_sources`
- `web_statement_documents`
- `web_statement_summaries`

정당 사이트 수집:
- `party_statement_sources`
- `party_statement_documents`
- `party_statement_summaries`

토픽 게이트:
- `statement_topics`
- `statement_topic_embeddings`
- `statement_topic_links`

공개 읽기:
- `telegram_statement_summaries`
- `web_statement_summaries`
- `party_statement_summaries`

## 공개 정책

현재 앱은 summary 테이블을 직접 읽는다. v1에서는 공개 feed에 필요한 summary 테이블에만 anon select를 허용하고 RLS로 row를 제한한다.

- Telegram: `status = 'extracted' and core_sentence is not null`
- Web: `status = 'extracted' and core_sentence is not null`이며 confirmed topic link에 포함된 row만 feed query에서 읽는다.
- Party: `status = 'extracted' and core_sentence is not null and topic_gate_status = 'matched'`
- Party public feed query also requires `topic_match_confidence >= STATEMENT_TOPIC_PARTY_THRESHOLD` so rows matched under an older lower threshold do not stay visible.

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

다만 공개 피드는 런타임 데이터이므로, 앱 코드는 초기 렌더와 `/api/statements` 모두에서 데이터 누락 시 빈 feed로 떨어지게 유지한다.

## 다음 refactor 후보

v2에서는 다음 통합을 고려한다.

- `telegram_statement_messages`와 `party_statement_documents`를 `source_documents`로 통합
- `telegram_statement_summaries`와 `party_statement_summaries`를 `statement_extractions`로 통합
- source별 parser 설정을 `statement_sources.fetch_config` jsonb로 이동
