# Statement Eval Lab

성명뭉 문장 실험실은 운영 피드 문장을 직접 수정하지 않고, 최근 문서 snapshot을 대상으로 여러 extractive span-plan system variant를 비교하기 위한 독립 실험 환경이다.

## 목적

- 기존 `core_sentence`와 `statement_display_decisions`를 덮어쓰지 않는다.
- 최근 7일 문서에서 새 실험 문장을 생성한다.
- LLM은 최종 문장을 직접 생성하지 않고 후보 문장/절 안의 span plan만 낸다.
- 코드는 span이 후보 substring인지 검증한 뒤 조합, cleansing, hard check를 수행한다.
- 인간 검수자는 생성된 문장 output 단위로 레이어별 점수와 메모를 저장한다.

## 데이터베이스

Migration:
- `supabase/migrations/20260612023000_statement_eval_lab.sql`

Tables:
- `statement_eval_runs`: 실험 run 단위
- `statement_eval_items`: run에 포함된 원문 snapshot
- `statement_eval_outputs`: system variant별 생성 결과
- `statement_eval_manual_scores`: output 문장 단위 인간 채점

`statement_eval_manual_scores`는 `run_id + item_id + output_id` 단위로 저장한다. 한 문서 안에서 최선 문장을 표시할 때는 `is_winner=true`를 사용하며, partial unique index가 같은 item 안의 winner를 하나로 제한한다.

모든 eval table은 RLS force enabled이며 anon/authenticated 권한을 revoke한다. `/ops`와 service role에서만 접근한다.

## 코드 구조

Core domain:
- `src/lib/statement-evals/types.ts`
- `src/lib/statement-evals/config.ts`
- `src/lib/statement-evals/source-loader.ts`
- `src/lib/statement-evals/candidates.ts`
- `src/lib/statement-evals/variants.ts`
- `src/lib/statement-evals/prompts.ts`
- `src/lib/statement-evals/schemas.ts`
- `src/lib/statement-evals/openai.ts`
- `src/lib/statement-evals/assembler.ts`
- `src/lib/statement-evals/repository.ts`
- `src/lib/statement-evals/run.ts`

Routes and UI:
- `src/app/api/ops/statement-evals/run/route.ts`
- `src/app/api/ops/statement-evals/score/route.ts`
- `src/app/ops/evals/page.tsx`
- `src/app/ops/evals/actions.ts`

Styles:
- `src/app/globals.css`의 `ops-eval-*` class group

Ops entry:
- `src/app/ops/page.tsx`에서 `/ops/evals` 링크 제공

## Variants

초기 system variants:
- `conservative_single_span`
- `title_issue_body_stance`
- `role_tag_then_span`
- `clause_level_strict`

Variant는 prompt만이 아니라 후보 생성기, prompt focus, span assembly, cleansing, hard check와 함께 평가되는 system 단위다. 새 variant를 추가하려면 `variants.ts`에 key/version/focus를 추가하고, 필요하면 `prompts.ts`에서 variant별 지시를 강화한다.

## Runtime

Manual UI:
- `/ops/evals`

Manual API:
- `POST /api/ops/statement-evals/run`
- `POST /api/ops/statement-evals/score`

API는 `OPS_RUN_SECRET` Bearer 인증을 사용한다. `/ops/evals` UI는 `/ops` proxy 인증 뒤 server action으로 실행되므로 브라우저에 `OPS_RUN_SECRET`을 노출하지 않는다.

기본 env:
- `OPENAI_STATEMENT_EVAL_MODEL=gpt-5-mini`
- `OPENAI_STATEMENT_EVAL_REASONING_EFFORT=low`
- `OPENAI_STATEMENT_EVAL_MAX_OUTPUT_TOKENS=3000`
- `STATEMENT_EVAL_LIMIT=20`
- `STATEMENT_EVAL_WINDOW_HOURS=168`

## Token Estimate

Eval lab stores estimated LLM token usage so prompt variants can be compared by quality and cost.

Stored fields:
- `statement_eval_runs.estimated_input_tokens`
- `statement_eval_runs.estimated_output_tokens`
- `statement_eval_runs.estimated_total_tokens`
- `statement_eval_outputs.estimated_input_tokens`
- `statement_eval_outputs.estimated_output_tokens`
- `statement_eval_outputs.estimated_total_tokens`

The estimate is calculated from the exact planner prompt and structured output text. It is intentionally approximate and is not a billing ledger. Its purpose is relative comparison between system variants in the same run: longer prompts, longer candidate sets, and longer planner JSON will show up as higher estimated totals.

## Human Scoring

채점 단위는 문서가 아니라 생성 문장 output이다. 각 output에 대해 다음 레이어를 1-5점으로 저장한다.

- `issue_score`: 사안 명확성
- `stance_score`: 판단/요구/입장/태도 명확성
- `composition_score`: 1-2문장 구성 품질
- `cleansing_score`: 대변인명, 라벨, URL 등 제거 품질
- `feed_score`: 피드에서 단독으로 읽히는 정도

`is_winner`는 한 문서 안에서 가장 좋은 output을 표시하기 위한 보조 필드다. 최종 system 선택은 winner rate뿐 아니라 output별 레이어 점수, hard gate pass rate, failure reason 분포를 함께 본다.

## Cleanup / Replacement Guide

실험실을 제거하려면 다음 순서가 안전하다.

1. `/ops/evals` 링크 제거: `src/app/ops/page.tsx`
2. UI 제거: `src/app/ops/evals/`
3. API 제거: `src/app/api/ops/statement-evals/`
4. domain 제거: `src/lib/statement-evals/`
5. CSS 제거: `src/app/globals.css`의 `ops-eval-*` block
6. env 제거: `.env.example`, `.env.local`의 `STATEMENT_EVAL_*`, `OPENAI_STATEMENT_EVAL_*`
7. DB 제거 migration 작성:
   - `drop table if exists public.statement_eval_manual_scores;`
   - `drop table if exists public.statement_eval_outputs;`
   - `drop table if exists public.statement_eval_items;`
   - `drop table if exists public.statement_eval_runs;`

운영 피드 파이프라인은 eval lab 테이블을 읽지 않는다. 따라서 eval lab을 제거해도 `/`, `/api/statements`, ingest cron, `statement_display_decisions`는 직접 영향받지 않는다.
