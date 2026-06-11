import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PrimaryTopicSummaryRow,
  WebTopicSummaryRow,
} from "./repository-types";
import type { TopicSummaryQueryOptions } from "./summary-repository-types";

export async function getRecentWebTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: TopicSummaryQueryOptions) {
  const enabledSourceKeys = await getEnabledWebSourceKeys(supabase);

  if (enabledSourceKeys.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("web_statement_summaries")
    .select(
      [
        "id",
        "document_id",
        "source_key",
        "external_id",
        "organization_name",
        "source_url",
        "title",
        "published_at",
        "document_type",
        "core_sentence",
        "extraction_confidence",
      ].join(","),
    )
    .eq("status", "extracted")
    .in("source_key", enabledSourceKeys)
    .not("core_sentence", "is", null)
    .gte("published_at", cutoffIso)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Omit<
    WebTopicSummaryRow,
    "text_snapshot"
  >[] | null) ?? [];
  const textSnapshots = await getWebTextSnapshots({ rows, supabase });

  return rows
    .map((row): PrimaryTopicSummaryRow => ({
      core_sentence: row.core_sentence,
      display_at: row.published_at,
      document_type: row.document_type,
      extraction_confidence: row.extraction_confidence,
      id: row.id,
      organization_name: row.organization_name,
      source_key: row.source_key,
      source_type: "web",
      source_url: row.source_url,
      text_snapshot: textSnapshots.get(row.document_id) ?? "",
      title: row.title,
    }))
    .filter((row) => row.display_at && row.text_snapshot.trim());
}

async function getEnabledWebSourceKeys(supabase: SupabaseClient) {
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

async function getWebTextSnapshots({
  rows,
  supabase,
}: {
  rows: Array<{
    document_id: string;
  }>;
  supabase: SupabaseClient;
}) {
  const documentIds = [...new Set(rows.map((row) => row.document_id))];

  if (documentIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("web_statement_documents")
    .select("id,text_snapshot")
    .in("id", documentIds);

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
