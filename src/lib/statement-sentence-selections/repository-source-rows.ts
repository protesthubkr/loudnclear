import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StatementSentenceSelectionRow,
  StatementSentenceSelectionSourceType,
} from "./types";

export async function getRowsForStatementSentenceSelection({
  cutoffIso,
  limit,
  sourceType,
  summaryId,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  sourceType?: StatementSentenceSelectionSourceType;
  summaryId?: string;
  supabase: SupabaseClient;
}) {
  const rows = (
    await Promise.all([
      sourceType === "party"
        ? Promise.resolve([])
        : getTelegramSelectionRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType === "telegram"
        ? Promise.resolve([])
        : getPartySelectionRows({ cutoffIso, limit, summaryId, supabase }),
    ])
  )
    .flat()
    .sort(compareSelectionRowsByDisplayAtDesc)
    .slice(0, limit);

  return rows;
}

async function getTelegramSelectionRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  summaryId?: string;
  supabase: SupabaseClient;
}) {
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
      textSnapshots.get(buildTelegramMessageKey(row.channel_username, row.message_id)) ??
      "",
    title: null,
  }));
}

async function getPartySelectionRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  summaryId?: string;
  supabase: SupabaseClient;
}) {
  let query = supabase
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
  const textSnapshots = await getPartyTextSnapshots({ rows, supabase });

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
    sourceType: "party" as const,
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.document_id) ?? "",
    title: row.title,
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

async function getPartyTextSnapshots({
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
    .from("party_statement_documents")
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

function compareSelectionRowsByDisplayAtDesc(
  left: StatementSentenceSelectionRow,
  right: StatementSentenceSelectionRow,
) {
  const leftTime = left.displayAt ? Date.parse(left.displayAt) : 0;
  const rightTime = right.displayAt ? Date.parse(right.displayAt) : 0;

  return rightTime - leftTime;
}

function buildTelegramMessageKey(channelUsername: string, messageId: number) {
  return `${channelUsername}:${messageId}`;
}
