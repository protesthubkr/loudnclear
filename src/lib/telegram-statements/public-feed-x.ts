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
  XStatementSummaryPublicRow,
} from "./public-feed-types";

type PublicXStatementSourceQuery = PublicStatementSourceQuery & {
  confirmedXSummaryIds: string[];
};

const X_PUBLIC_SUMMARY_COLUMNS = [
  "id",
  "organization_name",
  "source_url",
  "posted_at",
  "document_type",
  "core_sentence",
  "extraction_confidence",
].join(",");

export async function getPublicXStatementItems({
  confirmedXSummaryIds,
  fromIso,
  limit,
  toIso,
}: PublicXStatementSourceQuery) {
  const supabase = getSupabaseClient();

  if (!supabase || confirmedXSummaryIds.length === 0) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("x_statement_summaries")
    .select(X_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedXSummaryIds);

  if (fromIso) {
    query = query.gte("posted_at", fromIso);
  }

  if (toIso) {
    query = query.lt("posted_at", toIso);
  }

  const { data, error } = await query
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as XStatementSummaryPublicRow[] | null) ?? [])
    .filter(isPublicXStatementRowPublishable)
    .map((row) => ({
      coreSentence: normalizeFeedSentence(row.core_sentence),
      documentType: row.document_type,
      id: `x:${row.id}`,
      isTimeUnknown: false,
      messageCreatedAt: row.posted_at,
      organizationName: row.organization_name,
      sourceUrl: row.source_url,
      sourceType: "x" as const,
    }));
}

export async function hasPublicXStatementItemsBefore(
  beforeIso: string,
  confirmedXSummaryIds: string[],
) {
  const supabase = getSupabaseClient();

  if (!supabase || confirmedXSummaryIds.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from("x_statement_summaries")
    .select(X_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedXSummaryIds)
    .not("core_sentence", "is", null)
    .lt("posted_at", beforeIso)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(HAS_MORE_BEFORE_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as XStatementSummaryPublicRow[] | null) ?? []).some(
    isPublicXStatementRowPublishable,
  );
}

export async function getConfirmedXStatementSummaryIds(limit: number) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [] as string[];
  }

  const enabledSourceKeys = await getEnabledXSourceKeys();

  if (enabledSourceKeys.length === 0) {
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
    .eq("source_type", "x")
    .in("source_key", enabledSourceKeys)
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

async function getEnabledXSourceKeys() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("x_statement_sources")
    .select("source_key")
    .eq("enabled", true);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ source_key: string }> | null) ?? []).map(
    (row) => row.source_key,
  );
}

function isPublicXStatementRowPublishable(row: XStatementSummaryPublicRow) {
  return isStatementSentencePublishable({
    confidence: row.extraction_confidence,
    coreSentence: row.core_sentence,
    documentType: row.document_type,
  });
}
