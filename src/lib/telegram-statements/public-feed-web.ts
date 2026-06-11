import { getSelectedStatementDisplayDecisionMap } from "@/lib/statement-display-decisions/repository";
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

const WEB_PUBLIC_SUMMARY_COLUMNS = [
  "id",
  "source_key",
  "organization_name",
  "source_url",
  "published_at",
  "document_type",
].join(",");

export async function getPublicWebStatementItems({
  fromIso,
  limit,
  toIso,
}: PublicStatementSourceQuery) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return [] satisfies PublicStatementFeedItem[];
  }

  const enabledSourceKeys = await getEnabledWebSourceKeys();

  if (enabledSourceKeys.length === 0) {
    return [] satisfies PublicStatementFeedItem[];
  }

  let query = supabase
    .from("web_statement_summaries")
    .select(WEB_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("source_key", enabledSourceKeys);

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

  const rows = (data as unknown as WebStatementSummaryPublicRow[] | null) ?? [];
  const displayDecisions = await getSelectedStatementDisplayDecisionMap({
    sourceType: "web",
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
      id: `web:${row.id}`,
      isTimeUnknown: false,
      messageCreatedAt: row.published_at,
      organizationName: row.organization_name,
      sourceUrl: row.source_url,
      sourceType: "web" as const,
    }];
  });
}

export async function hasPublicWebStatementItemsBefore(
  beforeIso: string,
) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return false;
  }

  const enabledSourceKeys = await getEnabledWebSourceKeys();

  if (enabledSourceKeys.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from("web_statement_summaries")
    .select(WEB_PUBLIC_SUMMARY_COLUMNS)
    .eq("status", "extracted")
    .in("source_key", enabledSourceKeys)
    .lt("published_at", beforeIso)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(HAS_MORE_BEFORE_CANDIDATE_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as WebStatementSummaryPublicRow[] | null) ?? [];
  const displayDecisions = await getSelectedStatementDisplayDecisionMap({
    sourceType: "web",
    summaryIds: rows.map((row) => row.id),
    supabase,
  });

  return rows.some((row) => displayDecisions.has(row.id));
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
