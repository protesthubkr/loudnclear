import { getSelectedStatementDisplayDecisionMap } from "@/lib/statement-display-decisions/repository";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  HAS_MORE_BEFORE_CANDIDATE_LIMIT,
  normalizeFeedSentence,
  type PublicStatementSourceQuery,
} from "./public-feed-source-query";
import type {
  PublicStatementFeedItem,
  StatementSummaryPublicRow,
} from "./public-feed-types";

type PublicTelegramStatementSourceQuery = PublicStatementSourceQuery & {
  confirmedTelegramSummaryIds: string[];
};

const TELEGRAM_PUBLIC_SUMMARY_COLUMNS = [
  "id",
  "organization_name",
  "source_url",
  "message_created_at",
  "document_type",
].join(",");

export async function getPublicTelegramStatementItems({
  confirmedTelegramSummaryIds,
  fromIso,
  limit,
  toIso,
}: PublicTelegramStatementSourceQuery) {
  const supabase = getSupabaseAdminClient();

  if (!supabase || confirmedTelegramSummaryIds.length === 0) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("telegram_statement_summaries")
    .select(TELEGRAM_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedTelegramSummaryIds);

  if (fromIso) {
    query = query.gte("message_created_at", fromIso);
  }

  if (toIso) {
    query = query.lt("message_created_at", toIso);
  }

  const { data, error } = await query
    .order("message_created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as StatementSummaryPublicRow[] | null) ?? [];
  const displayDecisions = await getSelectedStatementDisplayDecisionMap({
    sourceType: "telegram",
    summaryIds: rows.map((row) => row.id),
    supabase,
  });

  return rows.flatMap((row) => {
    const displayDecision = displayDecisions.get(row.id);

    if (!displayDecision) {
      return [];
    }

    return [{
      coreSentence: normalizeFeedSentence(displayDecision.displaySentence),
      documentType: row.document_type,
      id: `telegram:${row.id}`,
      isTimeUnknown: false,
      messageCreatedAt: row.message_created_at,
      organizationName: row.organization_name,
      sourceUrl: row.source_url,
      sourceType: "telegram" as const,
    }];
  });
}

export async function hasPublicTelegramStatementItemsBefore(
  beforeIso: string,
  confirmedTelegramSummaryIds: string[],
) {
  const supabase = getSupabaseAdminClient();

  if (!supabase || confirmedTelegramSummaryIds.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from("telegram_statement_summaries")
    .select(TELEGRAM_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedTelegramSummaryIds)
    .lt("message_created_at", beforeIso)
    .order("message_created_at", { ascending: false, nullsFirst: false })
    .limit(HAS_MORE_BEFORE_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as StatementSummaryPublicRow[] | null) ?? [];
  const displayDecisions = await getSelectedStatementDisplayDecisionMap({
    sourceType: "telegram",
    summaryIds: rows.map((row) => row.id),
    supabase,
  });

  return rows.some((row) => displayDecisions.has(row.id));
}

export async function getConfirmedTelegramStatementSummaryIds(limit: number) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [] as string[];
  }

  const { data: topics, error: topicsError } = await supabase
    .from("statement_topics")
    .select("id")
    .eq("status", "confirmed")
    .order("window_ended_at", { ascending: false, nullsFirst: false })
    .limit(Math.max(limit, 100));

  if (topicsError) {
    throw new Error(topicsError.message);
  }

  const topicIds = ((topics as Array<{ id: string }> | null) ?? []).map(
    (topic) => topic.id,
  );

  if (topicIds.length === 0) {
    return [] as string[];
  }

  const { data: links, error: linksError } = await supabase
    .from("statement_topic_links")
    .select("source_summary_id")
    .eq("source_type", "telegram")
    .in("topic_id", topicIds)
    .limit(Math.max(limit * 10, 1000));

  if (linksError) {
    throw new Error(linksError.message);
  }

  return [
    ...new Set(
      ((links as Array<{ source_summary_id: string }> | null) ?? []).map(
        (link) => link.source_summary_id,
      ),
    ),
  ];
}
