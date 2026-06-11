import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PrimaryTopicSummaryRow,
  TelegramTopicSummaryRow,
} from "./repository-types";
import type { TopicSummaryQueryOptions } from "./summary-repository-types";

export async function getRecentTelegramTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: TopicSummaryQueryOptions) {
  const { data, error } = await supabase
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
        "core_sentence",
        "extraction_confidence",
      ].join(","),
    )
    .eq("status", "extracted")
    .not("core_sentence", "is", null)
    .gte("message_created_at", cutoffIso)
    .order("message_created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Omit<
    TelegramTopicSummaryRow,
    "text_snapshot"
  >[] | null) ?? [];
  const textSnapshots = await getTelegramTextSnapshots({ rows, supabase });

  return rows
    .map((row): PrimaryTopicSummaryRow => ({
      core_sentence: row.core_sentence,
      display_at: row.message_created_at,
      document_type: row.document_type,
      extraction_confidence: row.extraction_confidence,
      id: row.id,
      organization_name: row.organization_name,
      source_key: row.channel_username,
      source_type: "telegram",
      source_url: row.source_url,
      text_snapshot:
        textSnapshots.get(
          buildTelegramMessageKey(row.channel_username, row.message_id),
        ) ?? "",
      title: null,
    }))
    .filter((row) => row.display_at && row.text_snapshot.trim());
}

async function getTelegramTextSnapshots({
  rows,
  supabase,
}: {
  rows: Array<{
    channel_username: string;
    message_id: number;
  }>;
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
