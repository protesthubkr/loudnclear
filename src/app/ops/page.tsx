import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SITE_NAME } from "../site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `운영 점검 | ${SITE_NAME}`,
};

type StatusCount = {
  extracted: number;
  failed: number;
  matched?: number;
  pending: number;
  skipped: number;
  unmatched?: number;
};

type ScanRunRow = {
  candidates_created: number;
  channels_seen: number;
  error_message: string | null;
  finished_at: string | null;
  messages_seen: number;
  messages_written: number;
  started_at: string;
  status: string;
};

type PartySourceRow = {
  enabled: boolean;
  last_error: string | null;
  last_scanned_at: string | null;
  organization_name: string;
  source_key: string;
};

type ProblemRow = {
  core_sentence?: string | null;
  last_error: string | null;
  organization_name: string;
  source_url: string;
  status: string;
  title?: string | null;
  updated_at: string;
};

type PartyTopicRow = {
  core_sentence: string | null;
  organization_name: string;
  published_at: string | null;
  source_key: string;
  source_url: string;
  topic_gate_status: string;
  topic_match_confidence: number | null;
};

type TopicRow = {
  status: string;
  telegram_message_count: number;
  telegram_source_count: number;
  title: string;
  window_ended_at: string;
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

  const [
    telegramCounts,
    partyCounts,
    recentScanRuns,
    partySources,
    recentProblems,
    recentPartyTopics,
    recentTopics,
  ] = await Promise.all([
    getTelegramCounts(supabase),
    getPartyCounts(supabase),
    getRecentScanRuns(supabase),
    getPartySources(supabase),
    getRecentProblems(supabase),
    getRecentPartyTopics(supabase),
    getRecentTopics(supabase),
  ]);

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

        <OpsPanel title="정당 source">
          <OpsTable
            emptyText="source가 없습니다."
            headers={["source", "상태", "마지막 수집", "오류"]}
            rows={partySources.map((source) => [
              `${source.organization_name} (${source.source_key})`,
              source.enabled ? "enabled" : "disabled",
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

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="ops-status-card">
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </article>
  );
}

function OpsPanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="ops-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function OpsTable({
  emptyText,
  headers,
  rows,
}: {
  emptyText: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (rows.length === 0) {
    return <p className="ops-empty-line">{emptyText}</p>;
  }

  return (
    <div className="ops-table-wrap">
      <table className="ops-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpsList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: Array<{ href?: string; meta: string; text: string }>;
}) {
  if (items.length === 0) {
    return <p className="ops-empty-line">{emptyText}</p>;
  }

  return (
    <ul className="ops-list">
      {items.map((item, index) => (
        <li key={`${item.meta}:${index}`}>
          <p>{item.text}</p>
          {item.href ? (
            <a href={item.href} rel="noreferrer" target="_blank">
              {item.meta}
            </a>
          ) : (
            <span>{item.meta}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className={`ops-pill ops-pill--${value}`}>{value}</span>;
}

async function getTelegramCounts(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
): Promise<StatusCount> {
  const [extracted, pending, skipped, failed] = await Promise.all([
    countRows(supabase, "telegram_statement_summaries", {
      column: "status",
      value: "extracted",
    }),
    countRows(supabase, "telegram_statement_summaries", {
      column: "status",
      value: "pending",
    }),
    countRows(supabase, "telegram_statement_summaries", {
      column: "status",
      value: "skipped",
    }),
    countRows(supabase, "telegram_statement_summaries", {
      column: "status",
      value: "failed",
    }),
  ]);

  return { extracted, failed, pending, skipped };
}

async function getPartyCounts(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
): Promise<StatusCount> {
  const [extracted, pending, skipped, failed, matched, unmatched] =
    await Promise.all([
      countRows(supabase, "party_statement_summaries", {
        column: "status",
        value: "extracted",
      }),
      countRows(supabase, "party_statement_summaries", {
        column: "status",
        value: "pending",
      }),
      countRows(supabase, "party_statement_summaries", {
        column: "status",
        value: "skipped",
      }),
      countRows(supabase, "party_statement_summaries", {
        column: "status",
        value: "failed",
      }),
      countRows(supabase, "party_statement_summaries", {
        column: "topic_gate_status",
        value: "matched",
      }),
      countRows(supabase, "party_statement_summaries", {
        column: "topic_gate_status",
        value: "unmatched",
      }),
    ]);

  return { extracted, failed, matched, pending, skipped, unmatched };
}

async function countRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  table: string,
  filter: { column: string; value: string },
) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(filter.column, filter.value);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getRecentScanRuns(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
) {
  const { data, error } = await supabase
    .from("telegram_statement_scan_runs")
    .select(
      [
        "status",
        "started_at",
        "finished_at",
        "channels_seen",
        "messages_seen",
        "messages_written",
        "candidates_created",
        "error_message",
      ].join(","),
    )
    .order("started_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown) as ScanRunRow[];
}

async function getPartySources(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
) {
  const { data, error } = await supabase
    .from("party_statement_sources")
    .select("source_key,organization_name,enabled,last_scanned_at,last_error")
    .order("source_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PartySourceRow[];
}

async function getRecentProblems(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
) {
  const [party, telegram] = await Promise.all([
    supabase
      .from("party_statement_summaries")
      .select(
        "organization_name,source_url,title,status,last_error,updated_at,core_sentence",
      )
      .in("status", ["failed", "skipped"])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("telegram_statement_summaries")
      .select(
        "organization_name,source_url,status,last_error,updated_at,core_sentence",
      )
      .in("status", ["failed", "skipped"])
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  if (party.error) {
    throw new Error(party.error.message);
  }

  if (telegram.error) {
    throw new Error(telegram.error.message);
  }

  return [...((party.data ?? []) as ProblemRow[]), ...((telegram.data ?? []) as ProblemRow[])]
    .sort((first, second) => second.updated_at.localeCompare(first.updated_at))
    .slice(0, 8);
}

async function getRecentPartyTopics(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
) {
  const { data, error } = await supabase
    .from("party_statement_summaries")
    .select(
      [
        "source_key",
        "organization_name",
        "source_url",
        "published_at",
        "core_sentence",
        "topic_gate_status",
        "topic_match_confidence",
      ].join(","),
    )
    .eq("status", "extracted")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown) as PartyTopicRow[];
}

async function getRecentTopics(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
) {
  const { data, error } = await supabase
    .from("statement_topics")
    .select(
      "title,status,window_ended_at,telegram_source_count,telegram_message_count",
    )
    .eq("status", "confirmed")
    .order("window_ended_at", { ascending: false })
    .limit(6);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as TopicRow[];
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
