# 성명뭉 운영 Runbook

## 환경 변수

필수:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `OPENAI_API_KEY`

운영 화면:
- `OPS_BASIC_USER`
- `OPS_BASIC_PASSWORD`

## 로컬 점검

```powershell
npm run dev
```

cron API는 로컬에서 `CRON_SECRET`이 비어 있으면 인증 없이 실행할 수 있다. production에서는 반드시 Bearer 인증이 필요하다.

```powershell
$secret = (Select-String -Path .env.local -Pattern '^CRON_SECRET=').Line -replace '^CRON_SECRET=', ''
$headers = @{ Authorization = "Bearer $secret" }
Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/ingest/party-statements?dryRun=true&limit=3' -Headers $headers -UseBasicParsing
```

## Vercel cron

`vercel.json`에 등록된 cron은 production deployment에서 활성화된다. Vercel은 `CRON_SECRET` 환경 변수가 있으면 cron 요청의 `Authorization` header에 `Bearer <CRON_SECRET>` 값을 넣어 호출한다.

현재 schedule:
- 매시 00분: telegram statement scan
- 매시 10분: telegram statement extraction
- 매시 20분: party statement ingest
- 매시 30분: statement topic matching

statement topic matching은 원문 `text_snapshot` embedding 기준으로 동작하며, 기본 임계값은 telegram `0.55`, party `0.72`이다.

## 배포 후 확인 순서

1. Vercel production env에 필수 값을 모두 넣는다.
2. production deploy를 실행한다.
3. `/ops`에 Basic Auth로 접근한다.
4. 다음 순서로 dry-run API를 호출한다.
   - `/api/ingest/telegram-statements?dryRun=true`
   - `/api/ingest/telegram-statement-extractions?dryRun=true`
   - `/api/ingest/party-statements?dryRun=true&limit=3`
   - `/api/ingest/statement-topics?dryRun=true`
5. 문제가 없으면 non-dryRun을 1회씩 실행한다.
6. `/` 공개 피드와 `/ops` 상태를 확인한다.

## 장애 우선 확인

- 401: `CRON_SECRET` 불일치 또는 누락
- 500 with Supabase message: service role 또는 schema 누락
- OpenAI error: `OPENAI_API_KEY`, model, output token 설정 확인
- reasoning 설정 오류: `OPENAI_STATEMENT_REASONING_EFFORT` 값 확인
- party source empty: parser 변경 또는 source site HTML 변경 확인
- topic no match: confirmed telegram topic 생성 여부와 threshold 확인

## 2026-06-01 백필

목표 기간은 `2026-06-01 00:00:00 +09:00`부터 실행 시각까지다. route는 일회성 백필을 위해 최대 744시간까지 `windowHours`를 받는다. production에서는 모든 요청에 `CRON_SECRET` Bearer header를 붙인다.

```powershell
$baseUrl = 'https://YOUR_PRODUCTION_DOMAIN'
$secret = 'YOUR_CRON_SECRET'
$headers = @{ Authorization = "Bearer $secret" }
$since = [DateTimeOffset]'2026-06-01T00:00:00+09:00'
$windowHours = [Math]::Ceiling(([DateTimeOffset]::Now - $since).TotalHours)
```

권장 순서:

```powershell
Invoke-RestMethod "$baseUrl/api/ingest/telegram-statements?dryRun=true&backfill=true&windowHours=$windowHours&maxPages=80" -Headers $headers
Invoke-RestMethod "$baseUrl/api/ingest/telegram-statements?backfill=true&windowHours=$windowHours&maxPages=80" -Headers $headers

Invoke-RestMethod "$baseUrl/api/ingest/party-statements?dryRun=true&windowHours=$windowHours&limit=200" -Headers $headers
Invoke-RestMethod "$baseUrl/api/ingest/party-statements?windowHours=$windowHours&limit=200" -Headers $headers

Invoke-RestMethod "$baseUrl/api/ingest/telegram-statement-extractions?dryRun=true&windowHours=$windowHours&limit=100" -Headers $headers
Invoke-RestMethod "$baseUrl/api/ingest/telegram-statement-extractions?windowHours=$windowHours&limit=100" -Headers $headers

Invoke-RestMethod "$baseUrl/api/ingest/statement-topics?dryRun=true&windowHours=$windowHours&limit=500" -Headers $headers
Invoke-RestMethod "$baseUrl/api/ingest/statement-topics?windowHours=$windowHours&limit=500" -Headers $headers

# LLM sentence selector/verifier comparison. This does not replace public feed sentences.
Invoke-RestMethod "$baseUrl/api/ingest/statement-sentence-selections?dryRun=true&windowHours=$windowHours&limit=10" -Headers $headers
Invoke-RestMethod "$baseUrl/api/ingest/statement-sentence-selections?windowHours=$windowHours&limit=10" -Headers $headers
```

`telegram-statement-extractions`는 `pendingSeen`이 남아 있으면 같은 명령을 반복한다. topic matching은 telegram extraction이 충분히 끝난 뒤 실행해야 정당 성명 공개 게이트가 안정적으로 열린다.

sentence selector/verifier v4는 `statement_sentence_llm_selections.final_status`에 `review_needed`를 저장할 수 있어야 한다. production에서 non-dryRun을 실행하기 전에 `supabase/migrations/20260610143000_statement_sentence_llm_review_needed.sql`을 loudnclear Supabase에 적용한다.
