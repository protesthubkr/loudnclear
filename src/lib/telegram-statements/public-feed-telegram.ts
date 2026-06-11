import { isStatementSentencePublishable } from "@/lib/statement-quality/extraction-quality";
import { getSupabaseClient } from "@/lib/supabase";
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
  "core_sentence",
  "extraction_confidence",
].join(",");

export async function getPublicTelegramStatementItems({
  confirmedTelegramSummaryIds,
  fromIso,
  limit,
  toIso,
}: PublicTelegramStatementSourceQuery) {
  const supabase = getSupabaseClient();

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

  return ((data as unknown as StatementSummaryPublicRow[] | null) ?? [])
    .filter(isPublicTelegramStatementRowPublishable)
    .map((row) => ({
      coreSentence: normalizeFeedSentence(row.core_sentence),
      documentType: row.document_type,
      id: `telegram:${row.id}`,
      isTimeUnknown: false,
      messageCreatedAt: row.message_created_at,
      organizationName: row.organization_name,
      sourceUrl: row.source_url,
      sourceType: "telegram" as const,
    }));
}

export async function hasPublicTelegramStatementItemsBefore(
  beforeIso: string,
  confirmedTelegramSummaryIds: string[],
) {
  const supabase = getSupabaseClient();

  if (!supabase || confirmedTelegramSummaryIds.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from("telegram_statement_summaries")
    .select(TELEGRAM_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedTelegramSummaryIds)
    .not("core_sentence", "is", null)
    .lt("message_created_at", beforeIso)
    .order("message_created_at", { ascending: false, nullsFirst: false })
    .limit(HAS_MORE_BEFORE_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as StatementSummaryPublicRow[] | null) ?? []).some(
    isPublicTelegramStatementRowPublishable,
  );
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

function isPublicTelegramStatementRowPublishable(
  row: StatementSummaryPublicRow,
) {
  return isStatementSentencePublishable({
    confidence: row.extraction_confidence,
    coreSentence: row.core_sentence,
    documentType: row.document_type,
  });
}
