# 성명뭉 Supabase 분리 계획

## 기본 전략

초기 배포는 공유 Supabase로 빠르게 안정화할 수 있다. 독립 운영을 시작하기 전 또는 공개 트래픽이 생기기 전에는 성명뭉 전용 Supabase 프로젝트로 분리한다.

## 필요한 테이블

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
- `statement_topic_embeddings`
- `statement_topics`
- `statement_topic_links`

Canonical schema는 [../supabase/schema.sql](../supabase/schema.sql)에 둔다. 새 Supabase 프로젝트를 만들 때는 이 파일 전체를 먼저 적용한다.

## Migration 순서

1. `supabase/schema.sql` 적용
2. `party_statement_sources` seed 확인
3. `telegram_channel_subscriptions` seed 입력
4. RLS, grant, policy 확인
5. dry-run ingest 실행
6. non-dryRun ingest 실행
7. topic matching 실행

## 데이터 이관 선택지

- 새로 시작: 가장 단순하다. 공개 직전이면 권장한다.
- 최근 7일만 이관: 현재 피드 연속성을 유지한다.
- 전체 이관: 디버깅 자료를 보존하지만 검증 비용이 가장 크다.

권장: 최근 7일 이관 또는 새로 시작.

## 검증 기준

- anon key로 공개 feed에 필요한 extracted row만 읽힌다.
- service role로 ingest API가 insert/update/delete를 수행한다.
- `party_statement_summaries.topic_gate_status`가 `matched` 또는 `manual_matched`인 row만 공개된다.
- confirmed topic 기반 자동 매칭이 유지된다.
- `manual_hidden` row는 재매칭 후에도 공개되지 않는다.

## 전환 절차

1. 전용 Supabase 프로젝트를 만든다.
2. migration을 적용한다.
3. Vercel env를 전용 Supabase 값으로 바꾼다.
4. dry-run ingest를 모두 통과시킨다.
5. non-dryRun ingest를 source별 1회 실행한다.
6. statement topic matching을 실행한다.
7. 공개 피드와 `/ops`를 확인한다.
