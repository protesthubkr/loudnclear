import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getStatementEvalRunDetail,
  getStatementEvalRuns,
} from "@/lib/statement-evals/repository";
import type {
  StatementEvalItemRow,
  StatementEvalOutputRow,
  StatementEvalRunDetail,
  StatementEvalRunRow,
  StatementEvalVariantKey,
} from "@/lib/statement-evals/types";
import { STATEMENT_EVAL_VARIANTS } from "@/lib/statement-evals/variants";
import { SITE_NAME } from "@/app/site";
import { formatDateTime } from "../ops-format";
import {
  runStatementEvalLabAction,
  saveStatementEvalManualScoreAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `문장 실험실 | ${SITE_NAME}`,
};

type PageProps = {
  searchParams?: Promise<{ runId?: string }> | { runId?: string };
};

export default async function StatementEvalLabPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main className="ops-shell">
        <EvalHeader />
        <section className="ops-panel">
          <h2>Supabase 설정 필요</h2>
          <p>문장 실험실은 service role 기반의 실험 테이블을 사용합니다.</p>
        </section>
      </main>
    );
  }

  const runs = await getStatementEvalRuns({ supabase });
  const selectedRunId = params?.runId ?? runs[0]?.id ?? null;
  const detail = selectedRunId
    ? await getStatementEvalRunDetail({ runId: selectedRunId, supabase })
    : null;

  return (
    <main className="ops-shell ops-eval-shell">
      <EvalHeader />

      <section className="ops-grid ops-eval-top">
        <RunForm />
        <RunList runs={runs} selectedRunId={selectedRunId} />
      </section>

      {detail ? (
        <RunDetail detail={detail} />
      ) : (
        <section className="ops-panel">
          <h2>실험 run 없음</h2>
          <p>최근 7일 문서를 대상으로 새 실험 run을 생성하세요.</p>
        </section>
      )}
    </main>
  );
}

function EvalHeader() {
  return (
    <header className="ops-header">
      <p className="ops-kicker">
        <Link href="/ops">운영 점검</Link>
      </p>
      <h1>문장 실험실</h1>
      <p>
        운영 피드를 수정하지 않고, 최근 문서에 대해 여러 span-plan 시스템의
        문장을 생성한 뒤 사람이 직접 비교합니다.
      </p>
    </header>
  );
}

function RunForm() {
  return (
    <section className="ops-panel">
      <h2>새 실험 run</h2>
      <form action={runStatementEvalLabAction} className="ops-eval-form">
        <label>
          최근 기간
          <input defaultValue="168" min="1" name="windowHours" type="number" />
        </label>
        <label>
          대상 수
          <input defaultValue="10" max="500" min="1" name="limit" type="number" />
        </label>
        <label>
          출처
          <select defaultValue="" name="sourceType">
            <option value="">telegram + party + web</option>
            <option value="telegram">telegram</option>
            <option value="party">party</option>
            <option value="web">web</option>
            <option value="x">x</option>
          </select>
        </label>
        <fieldset>
          <legend>system variants</legend>
          {STATEMENT_EVAL_VARIANTS.map((variant) => (
            <label className="ops-eval-checkbox" key={variant.key}>
              <input
                defaultChecked
                name="variantKeys"
                type="checkbox"
                value={variant.key}
              />
              <span>
                <strong>{variant.key}</strong>
                <small>{variant.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <button className="ops-eval-primary" type="submit">
          실행
        </button>
      </form>
    </section>
  );
}

function RunList({
  runs,
  selectedRunId,
}: {
  runs: StatementEvalRunRow[];
  selectedRunId: string | null;
}) {
  return (
    <section className="ops-panel">
      <h2>최근 run</h2>
      {runs.length === 0 ? (
        <p>아직 실행된 실험이 없습니다.</p>
      ) : (
        <ul className="ops-eval-run-list">
          {runs.map((run) => (
            <li
              className={run.id === selectedRunId ? "is-selected" : undefined}
              key={run.id}
            >
              <Link href={`/ops/evals?runId=${run.id}`}>
                <strong>{formatDateTime(run.created_at)}</strong>
                <span>
                  {run.status} · items {run.item_count} · outputs{" "}
                  {run.output_count} · selected {run.selected_output_count} · tokens{" "}
                  {formatTokens(run.estimated_total_tokens)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RunDetail({ detail }: { detail: StatementEvalRunDetail }) {
  const variantStats = getVariantStats(detail);

  return (
    <>
      <section className="ops-grid ops-grid--summary" aria-label="실험 결과 요약">
        <article className="ops-status-card">
          <span>items</span>
          <strong>{detail.run.item_count}</strong>
        </article>
        <article className="ops-status-card">
          <span>outputs</span>
          <strong>{detail.run.output_count}</strong>
        </article>
        <article className="ops-status-card">
          <span>hard pass</span>
          <strong>
            {detail.items
              .flatMap((item) => item.outputs)
              .filter((output) => output.hard_gate_ok).length}
          </strong>
        </article>
        <article className="ops-status-card">
          <span>scored</span>
          <strong>
            {
              detail.items
                .flatMap((item) => item.outputs)
                .filter((output) => output.manual_score).length
            }
          </strong>
        </article>
        <article className="ops-status-card">
          <span>est. tokens</span>
          <strong>{formatTokens(detail.run.estimated_total_tokens)}</strong>
        </article>
      </section>

      <section className="ops-panel">
        <h2>variant 성과</h2>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>variant</th>
                <th>outputs</th>
                <th>hard pass</th>
                <th>wins</th>
                <th>est. tokens</th>
              </tr>
            </thead>
            <tbody>
              {variantStats.map((stat) => (
                <tr key={stat.key}>
                  <td>{stat.key}</td>
                  <td>{stat.outputs}</td>
                  <td>{stat.hardPass}</td>
                  <td>{stat.wins}</td>
                  <td>{formatTokens(stat.estimatedTotalTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ops-eval-items">
        {detail.items.map((item, index) => (
          <EvalItemCard
            index={index + 1}
            item={item}
            key={item.id}
            runId={detail.run.id}
          />
        ))}
      </section>
    </>
  );
}

function EvalItemCard({
  index,
  item,
  runId,
}: {
  index: number;
  item: StatementEvalItemRow;
  runId: string;
}) {
  return (
    <article className="ops-panel ops-eval-item">
      <header className="ops-eval-item-header">
        <div>
          <p className="ops-kicker">
            #{index} · {item.source_type} · {item.organization_name}
          </p>
          <h2>{item.title || item.current_display_sentence || item.source_key}</h2>
          <p>
            {formatDateTime(item.display_at)} ·{" "}
            <a href={item.source_url} rel="noreferrer" target="_blank">
              source
            </a>
          </p>
        </div>
      </header>

      <div className="ops-eval-baseline">
        <div>
          <strong>현재 노출문</strong>
          <p>{item.current_display_sentence || item.current_core_sentence || "-"}</p>
        </div>
        <details>
          <summary>원문 보기</summary>
          <pre>{truncateText(item.text_snapshot, 6000)}</pre>
        </details>
      </div>

      <div className="ops-eval-output-grid">
        {item.outputs.map((output) => (
          <OutputScoreForm
            itemId={item.id}
            key={output.id}
            output={output}
            runId={runId}
          />
        ))}
      </div>
    </article>
  );
}

function OutputScoreForm({
  itemId,
  output,
  runId,
}: {
  itemId: string;
  output: StatementEvalOutputRow;
  runId: string;
}) {
  const score = output.manual_score;

  return (
    <form
      action={saveStatementEvalManualScoreAction}
      className={`ops-eval-output ${score?.is_winner ? "is-winner" : ""}`}
    >
      <input name="runId" type="hidden" value={runId} />
      <input name="itemId" type="hidden" value={itemId} />
      <input name="outputId" type="hidden" value={output.id} />
      <span className="ops-eval-output-main">
        <strong>{output.variant_key}</strong>
        <span>{output.cleansed_sentence || output.failure_reason || "-"}</span>
      </span>
      <span className="ops-eval-badges">
        <Badge label={output.final_status} tone={output.final_status} />
        <Badge
          label={output.hard_gate_ok ? "hard ok" : "hard fail"}
          tone={output.hard_gate_ok ? "ok" : "failed"}
        />
        <Badge
          label={`issue ${output.issue_clarity ?? "-"}`}
          tone={output.issue_clarity === "missing" ? "failed" : "neutral"}
        />
        <Badge
          label={`stance ${output.stance_clarity ?? "-"}`}
          tone={output.stance_clarity === "missing" ? "failed" : "neutral"}
        />
        <Badge
          label={`tokens ${formatTokens(output.estimated_total_tokens)}`}
          tone="neutral"
        />
      </span>
      <small className="ops-eval-token-detail">
        estimated tokens: in {formatTokens(output.estimated_input_tokens)} / out{" "}
        {formatTokens(output.estimated_output_tokens)} / total{" "}
        {formatTokens(output.estimated_total_tokens)}
      </small>
      {output.planner_reason ? <em>{output.planner_reason}</em> : null}
      <label className="ops-eval-winner">
        <input
          defaultChecked={score?.is_winner ?? false}
          name="isWinner"
          type="checkbox"
        />
        최선 문장으로 표시
      </label>
      <div className="ops-eval-score-row">
        <ScoreInput label="사안" name="issueScore" value={score?.issue_score} />
        <ScoreInput
          label="입장"
          name="stanceScore"
          value={score?.stance_score}
        />
        <ScoreInput
          label="구성"
          name="compositionScore"
          value={score?.composition_score}
        />
        <ScoreInput
          label="정리"
          name="cleansingScore"
          value={score?.cleansing_score}
        />
        <ScoreInput label="피드" name="feedScore" value={score?.feed_score} />
      </div>
      <label className="ops-eval-notes">
        메모
        <textarea defaultValue={score?.notes ?? ""} name="notes" rows={2} />
      </label>
      <button className="ops-eval-primary" type="submit">
        문장 점수 저장
      </button>
    </form>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`ops-pill ops-pill--${tone}`}>{label}</span>;
}

function ScoreInput({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value?: number | null;
}) {
  return (
    <label>
      {label}
      <input
        defaultValue={value ?? ""}
        max="5"
        min="1"
        name={name}
        type="number"
      />
    </label>
  );
}

function getVariantStats(detail: StatementEvalRunDetail) {
  const stats = new Map<
    StatementEvalVariantKey,
    {
      estimatedTotalTokens: number;
      hardPass: number;
      key: StatementEvalVariantKey;
      outputs: number;
      wins: number;
    }
  >();

  for (const key of detail.run.variant_keys) {
    stats.set(key, {
      estimatedTotalTokens: 0,
      hardPass: 0,
      key,
      outputs: 0,
      wins: 0,
    });
  }

  for (const item of detail.items) {
    for (const output of item.outputs) {
      const stat =
        stats.get(output.variant_key) ??
        {
          estimatedTotalTokens: 0,
          hardPass: 0,
          key: output.variant_key,
          outputs: 0,
          wins: 0,
        };

      stat.outputs += 1;
      stat.estimatedTotalTokens += output.estimated_total_tokens;

      if (output.hard_gate_ok) {
        stat.hardPass += 1;
      }

      if (output.manual_score?.is_winner) {
        stat.wins += 1;
      }

      stats.set(output.variant_key, stat);
    }
  }

  return [...stats.values()];
}

function formatTokens(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}\n\n[truncated]`;
}
