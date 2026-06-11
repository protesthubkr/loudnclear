import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getStatementTopicPartyThreshold } from "@/lib/statement-topics/config";

type OpsSupabaseClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

type StatusCount = {
  extracted: number;
  failed: number;
  matched?: number;
  pending: number;
  skipped: number;
  unmatched?: number;
};

export type ScanRunRow = {
  candidates_created: number;
  channels_seen: number;
  error_message: string | null;
  finished_at: string | null;
  messages_seen: number;
  messages_written: number;
  started_at: string;
  status: string;
};

export type DataSourceRow = {
  last_error: string | null;
  last_scanned_at: string | null;
  organization_name: string;
  source_key: string;
  source_type: "party" | "telegram";
  source_url: string;
  status: string;
};

export type ProblemRow = {
  core_sentence?: string | null;
  last_error: string | null;
  organization_name: string;
  source_url: string;
  status: string;
  title?: string | null;
  updated_at: string;
};

export type PartyTopicRow = {
  core_sentence: string | null;
  organization_name: string;
  published_at: string | null;
  source_key: string;
  source_url: string;
  topic_gate_status: string;
  topic_match_confidence: number | null;
};

export type TopicRow = {
  status: string;
  telegram_message_count: number;
  telegram_source_count: number;
  title: string;
  window_ended_at: string;
};

export async function getOpsDashboardData(supabase: OpsSupabaseClient) {
  const [
    telegramCounts,
    partyCounts,
    recentScanRuns,
    dataSources,
    recentProblems,
    recentPartyTopics,
    recentTopics,
  ] = await Promise.all([
    getTelegramCounts(supabase),
    getPartyCounts(supabase),
    getRecentScanRuns(supabase),
    getDataSources(supabase),
    getRecentProblems(supabase),
    getRecentPartyTopics(supabase),
    getRecentTopics(supabase),
  ]);

  return {
    partyCounts,
    dataSources,
    recentPartyTopics,
    recentProblems,
    recentScanRuns,
    recentTopics,
    telegramCounts,
  };
}

export function formatDateTime(value: string | null) {
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

async function getTelegramCounts(
  supabase: OpsSupabaseClient,
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

async function getPartyCounts(supabase: OpsSupabaseClient): Promise<StatusCount> {
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
        minConfidence: getStatementTopicPartyThreshold(),
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
  supabase: OpsSupabaseClient,
  table: string,
  filter: { column: string; minConfidence?: number; value: string },
) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(filter.column, filter.value);

  if (filter.minConfidence !== undefined) {
    query = query.gte("topic_match_confidence", filter.minConfidence);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function getRecentScanRuns(supabase: OpsSupabaseClient) {
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

async function getDataSources(supabase: OpsSupabaseClient) {
  const [telegramSources, partySources] = await Promise.all([
    getTelegramSources(supabase),
    getPartySources(supabase),
  ]);

  return [...telegramSources, ...partySources].sort((first, second) => {
    const typeCompare = first.source_type.localeCompare(second.source_type);

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return first.organization_name.localeCompare(second.organization_name, "ko");
  });
}

async function getTelegramSources(
  supabase: OpsSupabaseClient,
): Promise<DataSourceRow[]> {
  const [subscriptions, states] = await Promise.all([
    supabase
      .from("telegram_channel_subscriptions")
      .select(
        [
          "channel_username",
          "channel_title",
          "status",
          "statement_feed_enabled",
          "last_checked_at",
          "last_checked_message_at",
          "last_error",
        ].join(","),
      )
      .order("channel_username", { ascending: true }),
    supabase
      .from("telegram_statement_scan_states")
      .select("channel_username,last_scanned_at,last_error"),
  ]);

  if (subscriptions.error) {
    throw new Error(subscriptions.error.message);
  }

  if (states.error) {
    throw new Error(states.error.message);
  }

  const stateByChannel = new Map(
    ((states.data ?? []) as Array<{
      channel_username: string;
      last_error: string | null;
      last_scanned_at: string | null;
    }>).map((state) => [state.channel_username, state]),
  );

  return ((subscriptions.data ?? []) as unknown as Array<{
    channel_title: string | null;
    channel_username: string;
    last_checked_at: string | null;
    last_checked_message_at: string | null;
    last_error: string | null;
    statement_feed_enabled: boolean;
    status: string;
  }>).map((subscription) => {
    const state = stateByChannel.get(subscription.channel_username);

    return {
      last_error: state?.last_error ?? subscription.last_error,
      last_scanned_at:
        state?.last_scanned_at ??
        subscription.last_checked_at ??
        subscription.last_checked_message_at,
      organization_name:
        subscription.channel_title ?? `@${subscription.channel_username}`,
      source_key: `@${subscription.channel_username}`,
      source_type: "telegram" as const,
      source_url: `https://t.me/s/${subscription.channel_username}`,
      status: getTelegramSourceStatus(subscription),
    };
  });
}

async function getPartySources(
  supabase: OpsSupabaseClient,
): Promise<DataSourceRow[]> {
  const { data, error } = await supabase
    .from("party_statement_sources")
    .select(
      "source_key,organization_name,list_url,enabled,last_scanned_at,last_error",
    )
    .order("source_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    enabled: boolean;
    last_error: string | null;
    last_scanned_at: string | null;
    list_url: string;
    organization_name: string;
    source_key: string;
  }>).map((source) => ({
    last_error: source.last_error,
    last_scanned_at: source.last_scanned_at,
    organization_name: source.organization_name,
    source_key: source.source_key,
    source_type: "party" as const,
    source_url: source.list_url,
    status: source.enabled ? "enabled" : "disabled",
  }));
}

function getTelegramSourceStatus(source: {
  statement_feed_enabled: boolean;
  status: string;
}) {
  if (source.status !== "active") {
    return source.status;
  }

  return source.statement_feed_enabled ? "enabled" : "disabled";
}

async function getRecentProblems(supabase: OpsSupabaseClient) {
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

  return [
    ...((party.data ?? []) as ProblemRow[]),
    ...((telegram.data ?? []) as ProblemRow[]),
  ]
    .sort((first, second) => second.updated_at.localeCompare(first.updated_at))
    .slice(0, 8);
}

async function getRecentPartyTopics(supabase: OpsSupabaseClient) {
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

async function getRecentTopics(supabase: OpsSupabaseClient) {
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
