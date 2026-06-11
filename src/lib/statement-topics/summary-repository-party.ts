import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartyTopicSummaryRow } from "./repository-types";
import type { TopicSummaryQueryOptions } from "./summary-repository-types";

export async function getRecentPartyTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: TopicSummaryQueryOptions) {
  const { data, error } = await supabase
    .from("party_statement_summaries")
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
        "core_sentence",
        "extraction_confidence",
        "topic_gate_status",
      ].join(","),
    )
    .eq("status", "extracted")
    .not("core_sentence", "is", null)
    .gte("published_at", cutoffIso)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Omit<
    PartyTopicSummaryRow,
    "text_snapshot"
  >[] | null) ?? [];
  const textSnapshots = await getPartyTextSnapshots({ rows, supabase });

  return rows
    .map((row) => ({
      ...row,
      text_snapshot: textSnapshots.get(row.document_id) ?? "",
    }))
    .filter((row) => row.published_at && row.text_snapshot.trim());
}

async function getPartyTextSnapshots({
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
    .from("party_statement_documents")
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
