import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  OpsList,
  OpsPanel,
  OpsTable,
  StatusCard,
  StatusPill,
} from "./ops-components";
import { formatDateTime, getOpsDashboardData } from "./ops-data";
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
    partyCounts,
    recentPartyTopics,
    recentProblems,
    recentScanRuns,
    recentTopics,
    telegramCounts,
    webCounts,
    xCounts,
  } = await getOpsDashboardData(supabase);

  return (
    <main className="ops-shell">
      <header className="ops-header">
        <p className="ops-kicker">{SITE_NAME}</p>
        <h1>운영 점검</h1>
        <p>수집, 추출, 토픽 게이트, 최근 실패 항목을 빠르게 확인합니다.</p>
      </header>

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

        <OpsPanel title="데이터 소스">
          <OpsTable
            emptyText="데이터 소스가 없습니다."
            headers={["유형", "source", "상태", "마지막 수집", "오류"]}
            rows={dataSources.map((source) => [
              source.source_type,
              <a
                className="ops-table-link"
                href={source.source_url}
                key={source.source_key}
                rel="noreferrer"
                target="_blank"
              >
                {source.organization_name} ({source.source_key})
              </a>,
              source.status,
              formatDateTime(source.last_scanned_at),
              source.last_error ?? "-",
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
