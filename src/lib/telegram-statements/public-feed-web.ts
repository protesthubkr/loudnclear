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
  WebStatementSummaryPublicRow,
} from "./public-feed-types";

type PublicWebStatementSourceQuery = PublicStatementSourceQuery & {
  confirmedWebSummaryIds: string[];
};

const WEB_PUBLIC_SUMMARY_COLUMNS = [
  "id",
  "source_key",
  "organization_name",
  "source_url",
  "published_at",
  "document_type",
  "core_sentence",
  "extraction_confidence",
].join(",");

export async function getPublicWebStatementItems({
  confirmedWebSummaryIds,
  fromIso,
  limit,
  toIso,
}: PublicWebStatementSourceQuery) {
  const supabase = getSupabaseClient();

  if (!supabase || confirmedWebSummaryIds.length === 0) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("web_statement_summaries")
    .select(WEB_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedWebSummaryIds);

  if (fromIso) {
    query = query.gte("published_at", fromIso);
  }

  if (toIso) {
    query = query.lt("published_at", toIso);
  }

  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as WebStatementSummaryPublicRow[] | null) ?? [])
    .filter(isPublicWebStatementRowPublishable)
    .map((row) => ({
      coreSentence: normalizeFeedSentence(row.core_sentence),
      documentType: row.document_type,
      id: `web:${row.id}`,
      isTimeUnknown: false,
      messageCreatedAt: row.published_at,
      organizationName: row.organization_name,
      sourceUrl: row.source_url,
      sourceType: "web" as const,
    }));
}

export async function hasPublicWebStatementItemsBefore(
  beforeIso: string,
  confirmedWebSummaryIds: string[],
) {
  const supabase = getSupabaseClient();

  if (!supabase || confirmedWebSummaryIds.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from("web_statement_summaries")
    .select(WEB_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("id", confirmedWebSummaryIds)
    .not("core_sentence", "is", null)
    .lt("published_at", beforeIso)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(HAS_MORE_BEFORE_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as WebStatementSummaryPublicRow[] | null) ?? []).some(
    isPublicWebStatementRowPublishable,
  );
}

export async function getConfirmedWebStatementSummaryIds(limit: number) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [] as string[];
  }

  const enabledSourceKeys = await getEnabledWebSourceKeys();

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
    .eq("source_type", "web")
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

async function getEnabledWebSourceKeys() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("web_statement_sources")
    .select("source_key")
    .eq("enabled", true);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ source_key: string }> | null) ?? []).map(
    (row) => row.source_key,
  );
}

function isPublicWebStatementRowPublishable(row: WebStatementSummaryPublicRow) {
  return isStatementSentencePublishable({
    confidence: row.extraction_confidence,
    coreSentence: row.core_sentence,
    documentType: row.document_type,
  });
}
