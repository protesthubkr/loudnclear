import "server-only";

import type {
  OpsSupabaseClient,
  PartyTopicRow,
  ProblemRow,
  ScanRunRow,
  TopicRow,
} from "./ops-types";

export async function getRecentScanRuns(supabase: OpsSupabaseClient) {
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

export async function getRecentProblems(supabase: OpsSupabaseClient) {
  const [party, telegram, web, x] = await Promise.all([
    getRecentProblemRows(
      supabase,
      "party_statement_summaries",
      "organization_name,source_url,title,status,last_error,updated_at,core_sentence",
    ),
    getRecentProblemRows(
      supabase,
      "telegram_statement_summaries",
      "organization_name,source_url,status,last_error,updated_at,core_sentence",
    ),
    getRecentProblemRows(
      supabase,
      "web_statement_summaries",
      "organization_name,source_url,title,status,last_error,updated_at,core_sentence",
    ),
    getRecentProblemRows(
      supabase,
      "x_statement_summaries",
      "organization_name,source_url,status,last_error,updated_at,core_sentence",
    ),
  ]);

  return [...party, ...telegram, ...web, ...x]
    .sort((first, second) => second.updated_at.localeCompare(first.updated_at))
    .slice(0, 8);
}

export async function getRecentPartyTopics(supabase: OpsSupabaseClient) {
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

export async function getRecentTopics(supabase: OpsSupabaseClient) {
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

async function getRecentProblemRows(
  supabase: OpsSupabaseClient,
  table: string,
  selectColumns: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select(selectColumns)
    .in("status", ["failed", "skipped"])
    .order("updated_at", { ascending: false })
    .limit(6);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown) as ProblemRow[];
}
