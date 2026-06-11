# 성명뭉 Refactoring Standards

## 현재 표준

- 현재 코드와 현재 DB schema를 표준으로 둔다.
- 구형 protesthub 호환 layer, 과거 공개 view, generic env fallback은 새로 유지하지 않는다.
- public feed는 `telegram_statement_summaries`, `party_statement_summaries` 직접 조회와 RLS 정책을 기준으로 한다.
- prompt, topic, extraction version은 코드의 현재 상수를 authority로 둔다.
- X 수집 API/클라이언트는 현재 파이프라인이 아니다. `x_statement_*` 테이블은 과거 데이터 조회/비교용 읽기 경로에서만 유지한다.

## 도달 기준

- `src` 안의 단일 파일은 기본적으로 300줄 이하를 목표로 한다.
- 250줄을 넘는 파일은 하나의 책임만 가져야 한다. 두 책임 이상이면 파일을 나눈다.
- public entrypoint는 유지하되, 내부 호환 re-export 파일은 만들지 않는다.
- 삭제한 경로는 `rg`로 참조가 0개인지 확인한다.
- 구형 토픽 상태값과 구형 env 이름이 현재 schema/code/docs에 남지 않아야 한다.
- 구조 분리는 호출부가 이미 쓰는 public import path를 우선 유지하고, 새 코드는 source/type/domain별 파일에 둔다.

## 검증 기준

리팩터링 후 아래가 통과해야 한다.

```powershell
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run lint
npm run build
```

공개 feed나 API 경로를 건드렸으면 최근 7일 window로 `/api/statements` 200 응답도 확인한다.
