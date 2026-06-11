# 성명뭉 운영 Runbook

## 환경 변수

필수:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `OPS_RUN_SECRET`
- `OPENAI_API_KEY`
- `WEB_STATEMENT_INGEST_WINDOW_HOURS`

운영 화면:
- `OPS_BASIC_USER`
- `OPS_BASIC_PASSWORD`

## 로컬 점검

```powershell
npm run dev
```

cron API는 로컬에서 `CRON_SECRET`이 비어 있으면 인증 없이 실행할 수 있다. production에서는 반드시 Bearer 인증이 필요하다. 수동 실행 옵션은 GET query가 아니라 `OPS_RUN_SECRET` Bearer 인증과 POST JSON body로 전달한다.

```powershell
$secret = (Select-String -Path .env.local -Pattern '^OPS_RUN_SECRET=').Line -replace '^OPS_RUN_SECRET=', ''
$headers = @{ Authorization = "Bearer $secret" }
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/ingest/party-statements' -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; limit = 3 } | ConvertTo-Json)
```

## Vercel cron

`vercel.json`에 등록된 cron은 production deployment에서 활성화된다. Vercel은 `CRON_SECRET` 환경 변수가 있으면 cron 요청의 `Authorization` header에 `Bearer <CRON_SECRET>` 값을 넣어 호출한다.

현재 schedule:
- 매시 00분: telegram statement scan
- 매시 10분: telegram statement extraction
- 매시 20분: party statement ingest
- 매시 25분: web statement ingest
- 매시 30분: statement topic matching

statement topic matching은 원문 `text_snapshot` embedding 기준으로 동작한다. confirmed topic은 telegram과 공식 웹사이트 web summary가 함께 형성하고, party summary는 confirmed topic에 붙은 경우에만 공개된다.
non-dryRun topic matching은 현재 party threshold보다 낮은 과거 matched row를 먼저 `unmatched`로 정리한다.
web statement ingest는 기본적으로 `WEB_STATEMENT_INGEST_WINDOW_HOURS` 기간 안의 문서만 저장한다. 2026-06-01 백필처럼 더 넓은 범위가 필요할 때만 POST JSON body의 `windowHours`로 명시한다.

공식 웹사이트 source:
- 환경운동연합: `https://kfem.or.kr/rss`
- 차제연: `https://equalityact.kr/feed/`
- 여성연합: `https://women21.or.kr/statement/`
- 무지개행동: `https://rainbowaction.kr/`
- 기후정의동맹: `https://www.climatejusticealliance.kr`
- 기후위기비상: `http://climate-strike.kr/feed/`

X API ingest cron은 중지되어 있으며, 공개 피드와 confirmed topic 입력에도 X summary를 사용하지 않는다. 기존 X 테이블과 수동 route는 과거 기록 점검용으로만 남긴다.

## 배포 후 확인 순서

1. Vercel production env에 필수 값을 모두 넣는다.
2. production deploy를 실행한다.
3. `/ops`에 Basic Auth로 접근한다.
4. 다음 순서로 dry-run API를 호출한다.
   - POST `/api/ingest/telegram-statements` body `{ "dryRun": true }`
   - POST `/api/ingest/telegram-statement-extractions` body `{ "dryRun": true }`
   - POST `/api/ingest/party-statements` body `{ "dryRun": true, "limit": 3 }`
   - POST `/api/ingest/web-statements` body `{ "dryRun": true, "limit": 3 }`
   - POST `/api/ingest/statement-topics` body `{ "dryRun": true }`
5. 문제가 없으면 non-dryRun을 1회씩 실행한다.
6. `/` 공개 피드와 `/ops` 상태를 확인한다.

## 장애 우선 확인

- 401: cron GET은 `CRON_SECRET`, 수동 POST는 `OPS_RUN_SECRET` 불일치 또는 누락
- 500 with Supabase message: service role 또는 schema 누락
- OpenAI error: `OPENAI_API_KEY`, model, output token 설정 확인
- reasoning 설정 오류: `OPENAI_STATEMENT_REASONING_EFFORT` 값 확인
- party source empty: parser 변경 또는 source site HTML 변경 확인
- web source empty: RSS/detail HTML 변경 또는 source별 candidate rule 확인
- topic no match: confirmed topic 형성 주체인 telegram/web summary 생성 여부와 threshold 확인

## 2026-06-01 백필

목표 기간은 `2026-06-01 00:00:00 +09:00`부터 실행 시각까지다. 수동 POST route는 일회성 백필을 위해 최대 744시간까지 `windowHours`를 받는다. production에서는 모든 수동 요청에 `OPS_RUN_SECRET` Bearer header를 붙인다.

```powershell
$baseUrl = 'https://YOUR_PRODUCTION_DOMAIN'
$secret = 'YOUR_OPS_RUN_SECRET'
$headers = @{ Authorization = "Bearer $secret" }
$since = [DateTimeOffset]'2026-06-01T00:00:00+09:00'
$windowHours = [Math]::Ceiling(([DateTimeOffset]::Now - $since).TotalHours)
```

권장 순서:

```powershell
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/telegram-statements" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; backfill = $true; windowHours = $windowHours; maxPages = 80 } | ConvertTo-Json)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/telegram-statements" -Headers $headers -ContentType 'application/json' -Body (@{ backfill = $true; windowHours = $windowHours; maxPages = 80 } | ConvertTo-Json)

Invoke-RestMethod -Method Post "$baseUrl/api/ingest/telegram-statement-extractions" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; windowHours = $windowHours; limit = 100 } | ConvertTo-Json)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/telegram-statement-extractions" -Headers $headers -ContentType 'application/json' -Body (@{ windowHours = $windowHours; limit = 100 } | ConvertTo-Json)

Invoke-RestMethod -Method Post "$baseUrl/api/ingest/web-statements" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; windowHours = $windowHours; limit = 200 } | ConvertTo-Json)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/web-statements" -Headers $headers -ContentType 'application/json' -Body (@{ windowHours = $windowHours; limit = 200 } | ConvertTo-Json)

Invoke-RestMethod -Method Post "$baseUrl/api/ingest/party-statements" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; windowHours = $windowHours; limit = 200 } | ConvertTo-Json)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/party-statements" -Headers $headers -ContentType 'application/json' -Body (@{ windowHours = $windowHours; limit = 200 } | ConvertTo-Json)

Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-topics" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; windowHours = $windowHours; limit = 500 } | ConvertTo-Json)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-topics" -Headers $headers -ContentType 'application/json' -Body (@{ windowHours = $windowHours; limit = 500 } | ConvertTo-Json)

# LLM sentence selector/verifier comparison. This does not replace public feed sentences.
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-sentence-selections" -Headers $headers -ContentType 'application/json' -Body (@{ dryRun = $true; windowHours = $windowHours; limit = 10 } | ConvertTo-Json)
Invoke-RestMethod -Method Post "$baseUrl/api/ingest/statement-sentence-selections" -Headers $headers -ContentType 'application/json' -Body (@{ windowHours = $windowHours; limit = 10 } | ConvertTo-Json)
```

`telegram-statement-extractions`는 `pendingSeen`이 남아 있으면 같은 명령을 반복한다. topic matching은 telegram/web extraction이 충분히 끝난 뒤 실행해야 confirmed topic과 정당 성명 공개 게이트가 안정적으로 열린다.

sentence selector/verifier v4는 `statement_sentence_llm_selections.final_status`에 `review_needed`를 저장할 수 있어야 한다. production에서 non-dryRun을 실행하기 전에 `supabase/migrations/20260610143000_statement_sentence_llm_review_needed.sql`을 loudnclear Supabase에 적용한다.
