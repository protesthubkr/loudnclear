import type { SupabaseClient } from "@supabase/supabase-js";
import { STATEMENT_DISPLAY_DECISION_PROMPT_VERSION } from "@/lib/statement-display-decisions/config";
import { getStatementTopicPartyThreshold } from "@/lib/statement-topics/config";
import type { PublicStatementFeedItem } from "./public-feed-types";

type PublicStatementFeedRpcQuery = {
  fromIso?: string;
  limit: number;
  toIso?: string;
};

type PublicStatementFeedRpcRow = {
  display_sentence: string | null;
  document_type: string | null;
  is_time_unknown: boolean | null;
  message_created_at: string | null;
  organization_name: string | null;
  source_summary_id: string;
  source_type: "party" | "telegram" | "web";
  source_url: string | null;
};

export async function getPublicStatementFeedItemsFromRpc({
  query,
  supabase,
}: {
  query: PublicStatementFeedRpcQuery;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase.rpc("get_public_statement_feed_items", {
    p_display_prompt_version: STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
    p_from: query.fromIso ?? null,
    p_limit: query.limit,
    p_party_threshold: getStatementTopicPartyThreshold(),
    p_to: query.toIso ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as PublicStatementFeedRpcRow[] | null) ?? [])
    .map(mapPublicStatementFeedRpcRow)
    .filter((item): item is PublicStatementFeedItem => item !== null);
}

export async function hasPublicStatementFeedItemsBeforeFromRpc({
  beforeIso,
  supabase,
}: {
  beforeIso?: string;
  supabase: SupabaseClient;
}) {
  if (!beforeIso) {
    return false;
  }

  const { data, error } = await supabase.rpc(
    "has_public_statement_feed_items_before",
    {
      p_before: beforeIso,
      p_display_prompt_version: STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
      p_party_threshold: getStatementTopicPartyThreshold(),
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

function mapPublicStatementFeedRpcRow(
  row: PublicStatementFeedRpcRow,
): PublicStatementFeedItem | null {
  const coreSentence = row.display_sentence?.replace(/\s+/g, " ").trim();

  if (!coreSentence || !row.organization_name || !row.source_url) {
    return null;
  }

  return {
    coreSentence,
    documentType: row.document_type ?? "statement",
    id: `${row.source_type}:${row.source_summary_id}`,
    isTimeUnknown: Boolean(row.is_time_unknown),
    messageCreatedAt: row.message_created_at,
    organizationName: row.organization_name,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
  };
}
