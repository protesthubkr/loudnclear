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

const TELEGRAM_PUBLIC_SUMMARY_COLUMNS = [
  "id",
  "organization_name",
  "source_url",
  "message_created_at",
  "document_type",
].join(",");

export async function getPublicTelegramStatementItems({
  fromIso,
  limit,
  toIso,
}: PublicStatementSourceQuery) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("telegram_statement_summaries")
    .select(TELEGRAM_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted");

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
) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("telegram_statement_summaries")
    .select(TELEGRAM_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
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
