import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PrimaryTopicSummaryRow,
  XTopicSummaryRow,
} from "./repository-types";
import type { TopicSummaryQueryOptions } from "./summary-repository-types";

export async function getRecentXTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: TopicSummaryQueryOptions) {
  const enabledSourceKeys = await getEnabledXSourceKeys(supabase);

  if (enabledSourceKeys.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("x_statement_summaries")
    .select(
      [
        "id",
        "post_id",
        "source_key",
        "x_post_id",
        "organization_name",
        "source_url",
        "posted_at",
        "document_type",
        "core_sentence",
        "extraction_confidence",
      ].join(","),
    )
    .eq("status", "extracted")
    .in("source_key", enabledSourceKeys)
    .not("core_sentence", "is", null)
    .gte("posted_at", cutoffIso)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Omit<
    XTopicSummaryRow,
    "text_snapshot"
  >[] | null) ?? [];
  const textSnapshots = await getXTextSnapshots({ rows, supabase });

  return rows
    .map((row): PrimaryTopicSummaryRow => ({
      core_sentence: row.core_sentence,
      display_at: row.posted_at,
      document_type: row.document_type,
      extraction_confidence: row.extraction_confidence,
      id: row.id,
      organization_name: row.organization_name,
      source_key: row.source_key,
      source_type: "x",
      source_url: row.source_url,
      text_snapshot: textSnapshots.get(row.post_id) ?? "",
      title: null,
    }))
    .filter((row) => row.display_at && row.text_snapshot.trim());
}

async function getEnabledXSourceKeys(supabase: SupabaseClient) {
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

async function getXTextSnapshots({
  rows,
  supabase,
}: {
  rows: Array<{
    post_id: string;
  }>;
  supabase: SupabaseClient;
}) {
  const postIds = [...new Set(rows.map((row) => row.post_id))];

  if (postIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("x_statement_posts")
    .select("id,text_snapshot")
    .in("id", postIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data as Array<{
      id: string;
      text_snapshot: string | null;
    }> | null) ?? []).map((row) => [row.id, row.text_snapshot ?? ""]),
  );
}
