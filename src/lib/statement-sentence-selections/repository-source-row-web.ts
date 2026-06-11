import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatementSentenceSelectionRow } from "./types";
import type { SourceSelectionQueryOptions } from "./repository-source-row-types";

export async function getWebSelectionRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceSelectionQueryOptions): Promise<StatementSentenceSelectionRow[]> {
  let query = supabase
    .from("web_statement_summaries")
    .select(
      [
        "id",
        "document_id",
        "source_key",
        "organization_name",
        "source_url",
        "title",
        "published_at",
        "document_type",
        "status",
        "core_sentence",
        "extraction_confidence",
        "extraction_reason",
        "model",
      ].join(","),
    )
    .in("status", ["extracted", "skipped"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (summaryId) {
    query = query.eq("id", summaryId);
  } else {
    query = query.gte("published_at", cutoffIso);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    core_sentence: string | null;
    document_id: string;
    document_type: StatementSentenceSelectionRow["documentType"];
    extraction_confidence: number | null;
    extraction_reason: string | null;
    id: string;
    model: string | null;
    organization_name: string;
    published_at: string | null;
    source_key: string;
    source_url: string;
    status: string;
    title: string;
  }> | null) ?? [];
  const textSnapshots = await getWebTextSnapshots({ rows, supabase });

  return rows.map((row) => ({
    currentCoreSentence: row.core_sentence,
    currentExtractionConfidence: row.extraction_confidence,
    currentExtractionReason: row.extraction_reason,
    currentModel: row.model,
    currentStatus: row.status,
    displayAt: row.published_at,
    documentType: row.document_type,
    id: row.id,
    organizationName: row.organization_name,
    sourceKey: row.source_key,
    sourceSummaryId: row.id,
    sourceType: "web" as const,
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.document_id) ?? "",
    title: row.title,
  }));
}

async function getWebTextSnapshots({
  rows,
  supabase,
}: {
  rows: Array<{ document_id: string }>;
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
    ((data as Array<{ id: string; text_snapshot: string | null }> | null) ?? []).map(
      (row) => [row.id, row.text_snapshot ?? ""],
    ),
  );
}
