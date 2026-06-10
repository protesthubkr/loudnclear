# 성명뭉

단체와 정당의 성명, 논평, 입장문에서 핵심 문장을 추출해 시간순 피드로 보여주는 독립 사이트입니다.

## Local Setup

1. `.env.example`을 `.env.local`로 복사합니다.
2. Supabase, OpenAI, cron secret 값을 채웁니다.
3. 의존성을 설치합니다.
   ```powershell
   npm install
   ```
4. 개발 서버를 실행합니다.
   ```powershell
   npm run dev
   ```

공개 피드는 `/`에서 제공됩니다. 수집과 처리 API는 `/api/ingest/*` 아래에 있습니다.

## Operations

- 구현 계획: [docs/independent-site-plan.md](docs/independent-site-plan.md)
- 우선순위 1-5 계획: [docs/priority-1-5-implementation-plan.md](docs/priority-1-5-implementation-plan.md)
- 운영 runbook: [docs/operations-runbook.md](docs/operations-runbook.md)
- Supabase 분리 계획: [docs/supabase-separation-plan.md](docs/supabase-separation-plan.md)
- DB schema: [docs/database-schema.md](docs/database-schema.md)

운영 점검 화면은 `/ops`입니다. production에서는 `OPS_BASIC_USER`, `OPS_BASIC_PASSWORD`가 설정되어야 접근할 수 있습니다.

## Checks

```powershell
npx tsc --noEmit
npm run lint
npm run build
```
