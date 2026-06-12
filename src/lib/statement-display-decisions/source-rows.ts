import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StatementDisplayDecisionSourceType,
  StatementDisplaySourceRow,
} from "./types";

type SourceRowQueryOptions = {
  cutoffIso: string;
  limit: number;
  summaryId?: string;
  supabase: SupabaseClient;
};

export async function getRowsForStatementDisplayDecision({
  cutoffIso,
  limit,
  sourceType,
  summaryId,
  supabase,
}: SourceRowQueryOptions & {
  sourceType?: StatementDisplayDecisionSourceType;
}) {
  const rows = (
    await Promise.all([
      sourceType && sourceType !== "telegram"
        ? Promise.resolve([])
        : getTelegramRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType && sourceType !== "party"
        ? Promise.resolve([])
        : getPartyRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType && sourceType !== "web"
        ? Promise.resolve([])
        : getWebRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType && sourceType !== "x"
        ? Promise.resolve([])
        : getXRows({ cutoffIso, limit, summaryId, supabase }),
    ])
  )
    .flat()
    .filter((row) => row.textSnapshot.trim() || row.title?.trim())
    .sort(compareRowsByDisplayAtDesc)
    .slice(0, limit);

  return rows;
}

async function getPartyRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceRowQueryOptions): Promise<StatementDisplaySourceRow[]> {
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

  const rows =
    (data as unknown as Array<{
      core_sentence: string | null;
      document_id: string;
      document_type: StatementDisplaySourceRow["documentType"];
      extraction_confidence: number | null;
      extraction_reason: string | null;
      id: string;
      model: string | null;
      organization_name: string;
      published_at: string | null;
      source_key: string;
      source_url: string;
      status: string;
      title: string | null;
    }> | null) ?? [];
  const textSnapshots = await getTextSnapshots({
    ids: rows.map((row) => row.document_id),
    supabase,
    table: "party_statement_documents",
  });

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
    sourceType: "party",
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.document_id) ?? "",
    title: row.title,
  }));
}

async function getTelegramRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceRowQueryOptions): Promise<StatementDisplaySourceRow[]> {
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

  const rows =
    (data as unknown as Array<{
      channel_username: string;
      core_sentence: string | null;
      document_type: StatementDisplaySourceRow["documentType"];
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
    sourceType: "telegram",
    sourceUrl: row.source_url,
    textSnapshot:
      textSnapshots.get(
        buildTelegramMessageKey(row.channel_username, row.message_id),
      ) ?? "",
    title: null,
  }));
}

async function getWebRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceRowQueryOptions): Promise<StatementDisplaySourceRow[]> {
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

  const rows =
    (data as unknown as Array<{
      core_sentence: string | null;
      document_id: string;
      document_type: StatementDisplaySourceRow["documentType"];
      extraction_confidence: number | null;
      extraction_reason: string | null;
      id: string;
      model: string | null;
      organization_name: string;
      published_at: string | null;
      source_key: string;
      source_url: string;
      status: string;
      title: string | null;
    }> | null) ?? [];
  const textSnapshots = await getTextSnapshots({
    ids: rows.map((row) => row.document_id),
    supabase,
    table: "web_statement_documents",
  });

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
    sourceType: "web",
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.document_id) ?? "",
    title: row.title,
  }));
}

async function getXRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceRowQueryOptions): Promise<StatementDisplaySourceRow[]> {
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

  const rows =
    (data as unknown as Array<{
      core_sentence: string | null;
      document_type: StatementDisplaySourceRow["documentType"];
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
  const textSnapshots = await getTextSnapshots({
    ids: rows.map((row) => row.post_id),
    supabase,
    table: "x_statement_posts",
  });

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
    sourceType: "x",
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.post_id) ?? "",
    title: null,
  }));
}

async function getTextSnapshots({
  ids,
  supabase,
  table,
}: {
  ids: string[];
  supabase: SupabaseClient;
  table: string;
}) {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from(table)
    .select("id,text_snapshot")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data as unknown as Array<{
      id: string;
      text_snapshot: string | null;
    }> | null) ?? [])
      .map((row) => [row.id, row.text_snapshot ?? ""]),
  );
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

function compareRowsByDisplayAtDesc(
  left: StatementDisplaySourceRow,
  right: StatementDisplaySourceRow,
) {
  const leftTime = left.displayAt ? Date.parse(left.displayAt) : 0;
  const rightTime = right.displayAt ? Date.parse(right.displayAt) : 0;

  return rightTime - leftTime;
}
