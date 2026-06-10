import { isStatementSentencePublishable } from "@/lib/statement-quality/extraction-quality";
import { getSupabaseClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePartyStatementDisplayTime } from "./public-feed-time";
import type {
  PartyStatementSummaryPublicRow,
  PublicStatementFeedItem,
  StatementSummaryPublicRow,
} from "./public-feed-types";

export type PublicStatementSourceQuery = {
  fromIso?: string;
  limit: number;
  toIso?: string;
};

export async function getPublicTelegramStatementItems({
  fromIso,
  limit,
  toIso,
}: PublicStatementSourceQuery) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [] satisfies PublicStatementFeedItem[];
  }

  const confirmedSummaryIds = await getConfirmedTelegramStatementSummaryIds(
    limit,
  );

  if (confirmedSummaryIds.length === 0) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("telegram_statement_summaries")
    .select(
      [
        "id",
        "organization_name",
        "source_url",
        "message_created_at",
        "document_type",
        "core_sentence",
        "extraction_confidence",
      ].join(","),
    )
    .eq("status", "extracted")
    .in("id", confirmedSummaryIds);

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
    .filter((row) =>
      isStatementSentencePublishable({
        confidence: row.extraction_confidence,
        coreSentence: row.core_sentence,
        documentType: row.document_type,
        sourceType: "telegram",
      }),
    )
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

export async function hasPublicTelegramStatementItemsBefore(beforeIso: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const confirmedSummaryIds = await getConfirmedTelegramStatementSummaryIds(500);

  if (confirmedSummaryIds.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from("telegram_statement_summaries")
    .select("id")
    .eq("status", "extracted")
    .in("id", confirmedSummaryIds)
    .lt("message_created_at", beforeIso)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ id: string }> | null) ?? []).length > 0;
}

async function getConfirmedTelegramStatementSummaryIds(limit: number) {
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

export async function getPublicPartyStatementItems({
  fromIso,
  limit,
  toIso,
}: PublicStatementSourceQuery) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("party_statement_summaries")
    .select(
      [
        "id",
        "organization_name",
        "source_key",
        "source_url",
        "published_at",
        "created_at",
        "document_type",
        "core_sentence",
        "extraction_confidence",
        "topic_gate_status",
      ].join(","),
    )
    .eq("status", "extracted")
    .eq("topic_gate_status", "matched");

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

  return ((data as unknown as PartyStatementSummaryPublicRow[] | null) ?? [])
    .filter((row) =>
      isStatementSentencePublishable({
        confidence: row.extraction_confidence,
        coreSentence: row.core_sentence,
        documentType: row.document_type,
        sourceType: "party",
      }),
    )
    .map((row) => {
      const displayTime = resolvePartyStatementDisplayTime({
        collectedAt: row.created_at,
        publishedAt: row.published_at,
        sourceKey: row.source_key,
      });

      return {
        coreSentence: normalizeFeedSentence(row.core_sentence),
        documentType: row.document_type,
        id: `party:${row.id}`,
        isTimeUnknown: displayTime.isTimeUnknown,
        messageCreatedAt: displayTime.timestamp,
        organizationName: row.organization_name,
        sourceUrl: row.source_url,
        sourceType: "party" as const,
      };
    });
}

export async function hasPublicPartyStatementItemsBefore(beforeIso: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("party_statement_summaries")
    .select("id")
    .eq("status", "extracted")
    .eq("topic_gate_status", "matched")
    .lt("published_at", beforeIso)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as Array<{ id: string }> | null) ?? []).length > 0;
}

function normalizeFeedSentence(value: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
