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
  type SourceHealthStatus,
} from "./ops-data";
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
        <p>데이터 소스, 수집, 추출, 토픽 게이트를 빠르게 확인합니다.</p>
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

function formatRecentSourceCounts(source: DataSourceRow) {
  return [
    `E ${source.recent_extracted_count.toLocaleString("ko-KR")}`,
    `P ${source.recent_pending_count.toLocaleString("ko-KR")}`,
    `S ${source.recent_skipped_count.toLocaleString("ko-KR")}`,
    `F ${source.recent_failed_count.toLocaleString("ko-KR")}`,
  ].join(" · ");
}
