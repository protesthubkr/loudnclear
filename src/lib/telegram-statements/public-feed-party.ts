import { getSelectedStatementDisplayDecisionMap } from "@/lib/statement-display-decisions/repository";
import { getStatementTopicPartyThreshold } from "@/lib/statement-topics/config";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  HAS_MORE_BEFORE_CANDIDATE_LIMIT,
  normalizeFeedSentence,
  type PublicStatementSourceQuery,
} from "./public-feed-source-query";
import { resolvePartyStatementDisplayTime } from "./public-feed-time";
import type {
  PartyStatementSummaryPublicRow,
  PublicStatementFeedItem,
} from "./public-feed-types";

const PARTY_PUBLIC_SUMMARY_COLUMNS = [
  "id",
  "organization_name",
  "source_key",
  "source_url",
  "published_at",
  "created_at",
  "document_type",
  "topic_gate_status",
].join(",");

export async function getPublicPartyStatementItems({
  fromIso,
  limit,
  toIso,
}: PublicStatementSourceQuery) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("party_statement_summaries")
    .select(PARTY_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .eq("topic_gate_status", "matched")
    .gte("topic_match_confidence", getStatementTopicPartyThreshold());

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

  const rows = (data as unknown as PartyStatementSummaryPublicRow[] | null) ?? [];
  const displayDecisions = await getSelectedStatementDisplayDecisionMap({
    sourceType: "party",
    summaryIds: rows.map((row) => row.id),
    supabase,
  });

  return rows.flatMap((row) => {
    const displayDecision = displayDecisions.get(row.id);

    if (!displayDecision) {
      return [];
    }

    return [mapPublicPartyStatementItem(row, displayDecision.displaySentence)];
  });
}

export async function hasPublicPartyStatementItemsBefore(beforeIso: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("party_statement_summaries")
    .select(PARTY_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .eq("topic_gate_status", "matched")
    .gte("topic_match_confidence", getStatementTopicPartyThreshold())
    .lt("published_at", beforeIso)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(HAS_MORE_BEFORE_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as PartyStatementSummaryPublicRow[] | null) ?? [];
  const displayDecisions = await getSelectedStatementDisplayDecisionMap({
    sourceType: "party",
    summaryIds: rows.map((row) => row.id),
    supabase,
  });

  return rows.some((row) => displayDecisions.has(row.id));
}

function mapPublicPartyStatementItem(
  row: PartyStatementSummaryPublicRow,
  displaySentence: string,
): PublicStatementFeedItem {
  const displayTime = resolvePartyStatementDisplayTime({
    collectedAt: row.created_at,
    publishedAt: row.published_at,
    sourceKey: row.source_key,
  });

  return {
    coreSentence: normalizeFeedSentence(displaySentence),
    documentType: row.document_type,
    id: `party:${row.id}`,
    isTimeUnknown: displayTime.isTimeUnknown,
    messageCreatedAt: displayTime.timestamp,
    organizationName: row.organization_name,
    sourceUrl: row.source_url,
    sourceType: "party",
  };
}
