# 성명뭉 우선순위 1-5 구현 계획

## Priority 1. 문서, env, 메타데이터 정리

목표: 복사된 앱이 아니라 성명뭉 독립 앱으로 읽히게 만든다.

작업:
- README를 성명뭉 기준으로 다시 작성한다.
- 사이트 title, description, H1, empty state를 성명뭉 기준으로 변경한다.
- `.env.example`의 topic threshold를 현재 코드값과 맞춘다.
- 운영용 `OPS_BASIC_USER`, `OPS_BASIC_PASSWORD`를 env 예시에 추가한다.
- `tsconfig.tsbuildinfo`, 로컬 로그 등 산출물 추적을 막는다.

완료 기준:
- `rg "Loud & Clear|ProtestHub|/statements" loudnclear`에 공개 제품명 흔적이 남지 않는다.
- `.env.example`과 코드 기본값이 충돌하지 않는다.

## Priority 2. Vercel cron과 운영 README 추가

목표: 배포 후 수집/추출/토픽 매칭이 자동으로 실행될 준비를 끝낸다.

작업:
- `vercel.json`에 cron schedule을 추가한다.
- 운영 runbook을 작성한다.
- 로컬 dry-run과 production 검증 절차를 문서화한다.

cron 초안:
- `0 * * * *` `/api/ingest/telegram-statements`
- `10 * * * *` `/api/ingest/telegram-statement-extractions`
- `20 * * * *` `/api/ingest/party-statements`
- `30 * * * *` `/api/ingest/statement-topics`

완료 기준:
- Vercel 배포 시 cron job이 생성될 수 있다.
- `CRON_SECRET` 기반 인증 경로가 문서화되어 있다.

## Priority 3. `/ops` 최소 점검 화면

목표: 운영자가 공개 피드 이상 징후를 코드 수정 전에 파악할 수 있게 한다.

작업:
- `/ops` 페이지를 추가한다.
- `/ops`는 Basic Auth로 보호한다.
- Supabase service role이 설정되어 있을 때 다음 정보를 표시한다.
  - 최근 telegram scan run
  - 정당 source 상태
  - telegram/party summary status count
  - 최근 failed/skipped 문서
  - 최근 matched/unmatched 정당 성명

완료 기준:
- local dev에서 `/ops`가 열린다.
- production에서는 ops credential 없이는 접근할 수 없다.

## Priority 4. 전용 Supabase 분리 계획서

목표: 당장은 공유 DB를 쓰더라도, 독립 DB로 옮길 때 빠뜨릴 테이블과 검증을 없앤다.

작업:
- 필요한 테이블 목록을 정리한다.
- migration 적용 순서를 정리한다.
- 이관 범위 선택지를 정리한다.
- RLS/anon 검증 절차를 정리한다.

완료 기준:
- 전용 Supabase로 옮길 때 실행 순서와 검증 기준이 문서에 있다.

## Priority 5. 배포 후 cron 연결 계획

목표: 실제 production 배포 후 빠르게 자동 수집을 켠다.

작업:
- Vercel env 설정 체크리스트를 작성한다.
- production deploy 후 확인할 API 호출 순서를 문서화한다.
- cron 로그 확인 위치와 실패 시 우선 확인 항목을 정리한다.

완료 기준:
- 배포자가 Vercel dashboard에서 env와 cron 상태를 확인할 수 있다.
- 첫 production run을 dry-run에서 non-dryRun으로 전환하는 순서가 문서화되어 있다.
