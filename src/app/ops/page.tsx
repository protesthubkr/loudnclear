import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  OpsList,
  OpsPanel,
  OpsTable,
  StatusCard,
  StatusPill,
} from "./ops-components";
import {
  formatDateTime,
  formatSourceType,
  getOpsDashboardData,
  type DataSourceRow,
  type DisplayDecisionReviewRow,
  type SourceHealthStatus,
} from "./ops-data";
import { reviewStatementDisplayDecisionAction } from "./actions";
import { SITE_NAME } from "../site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `운영 점검 | ${SITE_NAME}`,
};

export default async function OpsPage() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (
      <main className="ops-shell">
        <header className="ops-header">
          <p className="ops-kicker">{SITE_NAME}</p>
          <h1>운영 점검</h1>
        </header>
        <section className="ops-panel">
          <h2>Supabase 설정 필요</h2>
          <p>
            `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 설정되면
            이 화면에서 수집과 공개 상태를 확인할 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  const {
    dataSources,
    dataSourceHealthCounts,
    displayDecisionCounts,
    displayDecisionReviewRows,
    partyCounts,
    recentPartyTopics,
    recentProblems,
    recentScanRuns,
    recentTopics,
    telegramCounts,
    webCounts,
    xCounts,
  } = await getOpsDashboardData(supabase);
  const attentionSources = dataSources.filter(
    (source) => source.health_status === "needs_attention",
  );

  return (
    <main className="ops-shell">
      <header className="ops-header">
        <p className="ops-kicker">{SITE_NAME}</p>
        <h1>운영 점검</h1>
        <p>
          데이터 소스, 수집, 추출, 토픽 게이트를 빠르게 확인합니다.{" "}
          <a href="/ops/evals">문장 실험실</a>
        </p>
      </header>

      <section
        className="ops-grid ops-grid--summary"
        aria-label="데이터 소스 상태 요약"
      >
        <StatusCard label="소스 정상" value={dataSourceHealthCounts.ok} />
        <StatusCard
          label="점검 대상"
          value={dataSourceHealthCounts.needs_attention}
        />
        <StatusCard label="대기/미확인" value={dataSourceHealthCounts.unknown} />
        <StatusCard label="비활성" value={dataSourceHealthCounts.inactive} />
      </section>

      <section
        className="ops-grid ops-grid--summary"
        aria-label="문장 결정 상태 요약"
      >
        <StatusCard
          label="문장 selected"
          value={displayDecisionCounts.selected}
        />
        <StatusCard
          label="문장 review"
          value={displayDecisionCounts.review_needed}
        />
        <StatusCard
          label="문장 rejected"
          value={displayDecisionCounts.rejected}
        />
        <StatusCard label="문장 failed" value={displayDecisionCounts.failed} />
      </section>

      <section className="ops-grid ops-grid--summary" aria-label="상태 요약">
        <StatusCard label="텔레그램 extracted" value={telegramCounts.extracted} />
        <StatusCard label="텔레그램 pending" value={telegramCounts.pending} />
        <StatusCard label="텔레그램 failed" value={telegramCounts.failed} />
        <StatusCard label="X extracted" value={xCounts.extracted} />
        <StatusCard label="X pending" value={xCounts.pending} />
        <StatusCard label="X failed" value={xCounts.failed} />
        <StatusCard label="Web extracted" value={webCounts.extracted} />
        <StatusCard label="Web pending" value={webCounts.pending} />
        <StatusCard label="Web failed" value={webCounts.failed} />
        <StatusCard label="정당 공개 후보" value={partyCounts.matched ?? 0} />
        <StatusCard label="정당 unmatched" value={partyCounts.unmatched ?? 0} />
        <StatusCard label="정당 failed" value={partyCounts.failed} />
      </section>

      <section className="ops-grid">
        <OpsPanel title="문장 검토 큐">
          <OpsTable
            emptyText="검토가 필요한 문장이 없습니다."
            headers={[
              "상태",
              "출처",
              "단체",
              "노출 문장",
              "오류/판단",
              "후보",
            ]}
            rows={displayDecisionReviewRows.map((row) => [
              <StatusPill
                key="status"
                label={formatDisplayDecisionStatus(row.final_status)}
                value={row.final_status}
              />,
              formatSourceType(row.source_type),
              <a
                className="ops-table-link"
                href={row.source_url}
                key="source"
                rel="noreferrer"
                target="_blank"
              >
                <span className="ops-source-cell">
                  <strong>{row.organization_name}</strong>
                  <span>{row.source_key}</span>
                  <span>{formatDateTime(row.display_at)}</span>
                </span>
              </a>,
              <span className="ops-review-sentence" key="sentence">
                {row.display_sentence ?? row.core_sentence ?? "-"}
              </span>,
              <span className="ops-review-reason" key="reason">
                <strong>{row.last_error ?? "review_needed"}</strong>
                <span>{row.comparator_reason ?? "-"}</span>
                <span>{formatDisplayDecisionMeta(row)}</span>
              </span>,
              <DisplayDecisionDetails key="details" row={row} />,
            ])}
          />
        </OpsPanel>

        <OpsPanel title="점검 대상 데이터 소스">
          <OpsList
            emptyText="현재 점검 대상 데이터 소스가 없습니다."
            items={attentionSources.map((source) => ({
              href: source.source_url,
              meta: `${formatSourceType(source.source_type)} · 마지막 수집 ${formatDateTime(
                source.last_scanned_at,
              )}`,
              text: `${source.organization_name} (${source.source_key}) · ${source.health_reason}`,
            }))}
          />
        </OpsPanel>

        <OpsPanel title="최근 수집 실행">
          <OpsTable
            emptyText="최근 수집 실행 기록이 없습니다."
            headers={["상태", "시작", "메시지", "후보", "오류"]}
            rows={recentScanRuns.map((run) => [
              <StatusPill key="status" value={run.status} />,
              formatDateTime(run.started_at),
              `${run.messages_written}/${run.messages_seen}`,
              String(run.candidates_created),
              run.error_message ?? "-",
            ])}
          />
        </OpsPanel>

        <OpsPanel title="데이터 소스 현황">
          <OpsTable
            emptyText="데이터 소스가 없습니다."
            headers={[
              "점검",
              "유형",
              "source",
              "상태",
              "마지막 수집",
              "최근 7일",
              "사유",
            ]}
            rows={dataSources.map((source) => [
              <StatusPill
                key="health"
                label={formatHealthStatus(source.health_status)}
                value={source.health_status}
              />,
              formatSourceType(source.source_type),
              <a
                className="ops-table-link"
                href={source.source_url}
                key={source.source_key}
                rel="noreferrer"
                target="_blank"
              >
                <span className="ops-source-cell">
                  <strong>{source.organization_name}</strong>
                  <span>{source.source_key}</span>
                </span>
              </a>,
              <StatusPill
                key="status"
                label={formatSourceStatus(source.status)}
                value={source.status}
              />,
              formatDateTime(source.last_scanned_at),
              <span className="ops-counts" key="counts">
                {formatRecentSourceCounts(source)}
              </span>,
              source.health_reason,
            ])}
          />
        </OpsPanel>

        <OpsPanel title="최근 failed/skipped">
          <OpsList
            emptyText="최근 failed/skipped 항목이 없습니다."
            items={recentProblems.map((item) => ({
              href: item.source_url,
              meta: `${item.organization_name} · ${item.status} · ${formatDateTime(
                item.updated_at,
              )}`,
              text: item.title || item.core_sentence || item.last_error || "-",
            }))}
          />
        </OpsPanel>

        <OpsPanel title="정당 토픽 게이트">
          <OpsList
            emptyText="최근 정당 성명이 없습니다."
            items={recentPartyTopics.map((item) => ({
              href: item.source_url,
              meta: `${item.organization_name} · ${item.topic_gate_status} · ${
                item.topic_match_confidence ?? "-"
              }`,
              text: item.core_sentence ?? "(문구 없음)",
            }))}
          />
        </OpsPanel>

        <OpsPanel title="최근 confirmed topic">
          <OpsList
            emptyText="최근 topic이 없습니다."
            items={recentTopics.map((topic) => ({
              meta: `${topic.status} · ${topic.telegram_source_count} sources · ${formatDateTime(
                topic.window_ended_at,
              )}`,
              text: topic.title,
            }))}
          />
        </OpsPanel>
      </section>
    </main>
  );
}

function formatHealthStatus(status: SourceHealthStatus) {
  switch (status) {
    case "inactive":
      return "비활성";
    case "needs_attention":
      return "점검";
    case "ok":
      return "정상";
    case "unknown":
      return "대기";
  }
}

function formatSourceStatus(status: string) {
  switch (status) {
    case "active":
      return "활성";
    case "disabled":
      return "중지";
    case "enabled":
      return "사용";
    case "paused":
      return "일시중지";
    default:
      return status;
  }
}

function DisplayDecisionDetails({ row }: { row: DisplayDecisionReviewRow }) {
  return (
    <details className="ops-review-details">
      <summary>보기</summary>
      <dl>
        <div>
          <dt>제목</dt>
          <dd>{row.title ?? "-"}</dd>
        </div>
        <div>
          <dt>A 후보</dt>
          <dd>{row.candidate_a_sentence ?? "-"}</dd>
        </div>
        <div>
          <dt>C 후보</dt>
          <dd>{row.candidate_c_sentence ?? "-"}</dd>
        </div>
        <div>
          <dt>core</dt>
          <dd>{row.core_sentence ?? "-"}</dd>
        </div>
        <div>
          <dt>갱신</dt>
          <dd>{formatDateTime(row.updated_at)}</dd>
        </div>
      </dl>
      <form action={reviewStatementDisplayDecisionAction}>
        <input name="decisionId" type="hidden" value={row.id} />
        <button
          disabled={!row.candidate_a_sentence}
          name="choice"
          type="submit"
          value="A"
        >
          A 선택
        </button>
        <button
          disabled={!row.candidate_c_sentence}
          name="choice"
          type="submit"
          value="C"
        >
          C 선택
        </button>
        <button name="choice" type="submit" value="reject">
          기각
        </button>
      </form>
    </details>
  );
}

function formatDisplayDecisionStatus(
  status: DisplayDecisionReviewRow["final_status"],
) {
  switch (status) {
    case "failed":
      return "실패";
    case "rejected":
      return "제외";
    case "review_needed":
      return "검토";
    case "selected":
      return "선택";
  }
}

function formatDisplayDecisionMeta(row: DisplayDecisionReviewRow) {
  return [
    row.selected_mode,
    row.sentence_role,
    row.subject_clarity,
    row.stance_clarity,
    row.confidence === null ? null : `C ${row.confidence}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatRecentSourceCounts(source: DataSourceRow) {
  return [
    `E ${source.recent_extracted_count.toLocaleString("ko-KR")}`,
    `P ${source.recent_pending_count.toLocaleString("ko-KR")}`,
    `S ${source.recent_skipped_count.toLocaleString("ko-KR")}`,
    `F ${source.recent_failed_count.toLocaleString("ko-KR")}`,
  ].join(" · ");
}
