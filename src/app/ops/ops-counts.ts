import "server-only";

import { getStatementTopicPartyThreshold } from "@/lib/statement-topics/config";
import type { OpsSupabaseClient, StatusCount } from "./ops-types";

export async function getTelegramCounts(
  supabase: OpsSupabaseClient,
): Promise<StatusCount> {
  return getBasicStatusCounts(supabase, "telegram_statement_summaries");
}

export async function getXCounts(
  supabase: OpsSupabaseClient,
): Promise<StatusCount> {
  return getBasicStatusCounts(supabase, "x_statement_summaries");
}

export async function getWebCounts(
  supabase: OpsSupabaseClient,
): Promise<StatusCount> {
  return getBasicStatusCounts(supabase, "web_statement_summaries");
}

export async function getPartyCounts(
  supabase: OpsSupabaseClient,
): Promise<StatusCount> {
  const [basicCounts, matched, unmatched] = await Promise.all([
    getBasicStatusCounts(supabase, "party_statement_summaries"),
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

  return { ...basicCounts, matched, unmatched };
}

async function getBasicStatusCounts(
  supabase: OpsSupabaseClient,
  table: string,
): Promise<StatusCount> {
  const [extracted, pending, skipped, failed] = await Promise.all([
    countRows(supabase, table, {
      column: "status",
      value: "extracted",
    }),
    countRows(supabase, table, {
      column: "status",
      value: "pending",
    }),
    countRows(supabase, table, {
      column: "status",
      value: "skipped",
    }),
    countRows(supabase, table, {
      column: "status",
      value: "failed",
    }),
  ]);

  return { extracted, failed, pending, skipped };
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
