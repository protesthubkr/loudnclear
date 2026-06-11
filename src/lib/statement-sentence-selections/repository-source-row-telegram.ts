import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatementSentenceSelectionRow } from "./types";
import type { SourceSelectionQueryOptions } from "./repository-source-row-types";

export async function getTelegramSelectionRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceSelectionQueryOptions): Promise<StatementSentenceSelectionRow[]> {
  let query = supabase
    .from("telegram_statement_summaries")
    .select(
      [
        "id",
        "channel_username",
        "message_id",
        "organization_name",
        "source_url",
        "message_created_at",
        "document_type",
        "status",
        "core_sentence",
        "extraction_confidence",
        "extraction_reason",
        "model",
      ].join(","),
    )
    .in("status", ["extracted", "skipped"])
    .order("message_created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (summaryId) {
    query = query.eq("id", summaryId);
  } else {
    query = query.gte("message_created_at", cutoffIso);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    channel_username: string;
    core_sentence: string | null;
    document_type: StatementSentenceSelectionRow["documentType"];
    extraction_confidence: number | null;
    extraction_reason: string | null;
    id: string;
    message_created_at: string | null;
    message_id: number;
    model: string | null;
    organization_name: string;
    source_url: string;
    status: string;
  }> | null) ?? [];
  const textSnapshots = await getTelegramTextSnapshots({ rows, supabase });

  return rows.map((row) => ({
    currentCoreSentence: row.core_sentence,
    currentExtractionConfidence: row.extraction_confidence,
    currentExtractionReason: row.extraction_reason,
    currentModel: row.model,
    currentStatus: row.status,
    displayAt: row.message_created_at,
    documentType: row.document_type,
    id: row.id,
    organizationName: row.organization_name,
    sourceKey: row.channel_username,
    sourceSummaryId: row.id,
    sourceType: "telegram" as const,
    sourceUrl: row.source_url,
    textSnapshot:
      textSnapshots.get(
        buildTelegramMessageKey(row.channel_username, row.message_id),
      ) ?? "",
    title: null,
  }));
}

async function getTelegramTextSnapshots({
  rows,
  supabase,
}: {
  rows: Array<{ channel_username: string; message_id: number }>;
  supabase: SupabaseClient;
}) {
  const channels = [...new Set(rows.map((row) => row.channel_username))];
  const messageIds = [...new Set(rows.map((row) => row.message_id))];

  if (channels.length === 0 || messageIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("telegram_statement_messages")
    .select("channel_username,message_id,text_snapshot")
    .in("channel_username", channels)
    .in("message_id", messageIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data as Array<{
      channel_username: string;
      message_id: number;
      text_snapshot: string | null;
    }> | null) ?? []).map((row) => [
      buildTelegramMessageKey(row.channel_username, row.message_id),
      row.text_snapshot ?? "",
    ]),
  );
}

function buildTelegramMessageKey(channelUsername: string, messageId: number) {
  return `${channelUsername}:${messageId}`;
}
