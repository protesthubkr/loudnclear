import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatementSentenceSelectionRow } from "./types";
import type { SourceSelectionQueryOptions } from "./repository-source-row-types";

export async function getXSelectionRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceSelectionQueryOptions): Promise<StatementSentenceSelectionRow[]> {
  let query = supabase
    .from("x_statement_summaries")
    .select(
      [
        "id",
        "post_id",
        "source_key",
        "organization_name",
        "source_url",
        "posted_at",
        "document_type",
        "status",
        "core_sentence",
        "extraction_confidence",
        "extraction_reason",
        "model",
      ].join(","),
    )
    .in("status", ["extracted", "skipped"])
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (summaryId) {
    query = query.eq("id", summaryId);
  } else {
    query = query.gte("posted_at", cutoffIso);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    core_sentence: string | null;
    document_type: StatementSentenceSelectionRow["documentType"];
    extraction_confidence: number | null;
    extraction_reason: string | null;
    id: string;
    model: string | null;
    organization_name: string;
    post_id: string;
    posted_at: string | null;
    source_key: string;
    source_url: string;
    status: string;
  }> | null) ?? [];
  const textSnapshots = await getXTextSnapshots({ rows, supabase });

  return rows.map((row) => ({
    currentCoreSentence: row.core_sentence,
    currentExtractionConfidence: row.extraction_confidence,
    currentExtractionReason: row.extraction_reason,
    currentModel: row.model,
    currentStatus: row.status,
    displayAt: row.posted_at,
    documentType: row.document_type,
    id: row.id,
    organizationName: row.organization_name,
    sourceKey: row.source_key,
    sourceSummaryId: row.id,
    sourceType: "x" as const,
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.post_id) ?? "",
    title: null,
  }));
}

async function getXTextSnapshots({
  rows,
  supabase,
}: {
  rows: Array<{ post_id: string }>;
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
    ((data as Array<{ id: string; text_snapshot: string | null }> | null) ?? []).map(
      (row) => [row.id, row.text_snapshot ?? ""],
    ),
  );
}
