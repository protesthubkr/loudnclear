# LLM Sentence Selection Redesign

성명뭉의 기존 `core_sentence` 추출 결과를 바로 대체하지 않고, LLM selector/verifier 결과를 별도 테이블에 병렬 저장해 비교한다.

## 방향

- 기존 `telegram_statement_summaries.core_sentence`와 `party_statement_summaries.core_sentence`는 유지한다.
- 새 결과는 `statement_sentence_llm_selections`에 저장한다.
- selector와 verifier는 항상 모두 실행한다.
- 제목 후보를 반드시 포함한다.
- LLM은 문장을 생성하거나 고쳐 쓰지 않는다. 서버가 생성한 후보 문장 `sentence_id` 중 하나만 고른다.
- 기존 rule-v2는 새 selector 경로에서 문장 선정에 쓰지 않는다. 새 경로의 결정은 LLM selector/verifier와 얇은 deterministic validation으로만 한다.
- v4부터 바이라인, 안내/자료 소개, 사건 발생 사실만 담긴 배경문, 쉼표/연결 어미로 끝나는 미완성 조각은 후보 또는 검증 단계에서 걸러낸다.
- `notice`, `resource_intro`, `context`, `tribute`처럼 바로 공개하기 애매한 역할은 무조건 탈락시키지 않고 `review_needed`로 저장해 후속 품질 검토 대상으로 남긴다.

## 실행 경로

```text
processed summary row
→ title/body sentence candidates
→ LLM selector
→ LLM verifier
→ deterministic validation
→ statement_sentence_llm_selections upsert
```

실행 API:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod "$baseUrl/api/ingest/statement-sentence-selections?dryRun=true&limit=10" -Headers $headers
Invoke-RestMethod "$baseUrl/api/ingest/statement-sentence-selections?limit=10" -Headers $headers
```

옵션:

- `dryRun=true`: LLM 호출과 DB 저장 없이 대상 행과 후보 수만 확인한다.
- `force=true`: 같은 selector/verifier 버전의 기존 비교 결과가 있어도 다시 실행한다.
- `sourceType=telegram|party`: 특정 출처 유형만 실행한다.
- `summaryId=<uuid>`: 특정 summary 한 건만 실행한다.
- `windowHours=<1..744>`: 최근 처리 범위를 조정한다.
- `limit=<1..100>`: 실행 건수를 조정한다.

## 비교 기준

비교할 주요 컬럼:

- `current_core_sentence`: 기존 rule/LLM 추출 결과
- `selected_sentence`: 새 LLM selector/verifier 결과
- `final_status`: `selected`, `rejected`, `review_needed`, `failed`
- `selector_sentence_role`, `verifier_sentence_role`
- `selector_target_subject`, `verifier_target_subject`
- `selector_stance_action`, `verifier_stance_action`
- `last_error`: 검증 실패 또는 실행 실패 이유

초기 검토는 다음 케이스를 우선한다.

- 기존 결과가 `lead_headline`이고 새 결과가 다른 문장을 고른 경우
- 기존 결과가 `topic_gate_status=unmatched`인 party 문서
- 새 결과가 `rejected`인데 기존 결과가 공개 가능했던 경우
- 새 결과가 `review_needed`인 경우
- 기존 결과가 `skipped`였는데 새 결과가 `selected`인 경우

## 전환 원칙

새 결과는 충분한 샘플 검토 전까지 public feed에 사용하지 않는다. 검토 후에는 `statement_sentence_llm_selections.final_status='selected'`인 행만 대상으로 별도 전환 작업을 설계한다. `review_needed`는 전환 후보가 아니라 프롬프트/휴리스틱 개선을 위한 검토 큐로 본다.
