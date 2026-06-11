import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PartyTopicSummaryRow,
  PrimaryTopicSummaryRow,
  TelegramTopicSummaryRow,
  XTopicSummaryRow,
} from "./repository-types";

export async function getRecentTelegramTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  supabase: SupabaseClient;
}) {
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
        textSnapshots.get(buildTelegramMessageKey(row.channel_username, row.message_id)) ??
        "",
      title: null,
    }))
    .filter((row) => row.display_at && row.text_snapshot.trim());
}

export async function getRecentXTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  supabase: SupabaseClient;
}) {
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

export async function getRecentPartyTopicSummaries({
  cutoffIso,
  limit,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  supabase: SupabaseClient;
}) {
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

  return rows.map((row) => ({
    ...row,
    text_snapshot: textSnapshots.get(row.document_id) ?? "",
  })).filter((row) => row.published_at && row.text_snapshot.trim());
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

function buildTelegramMessageKey(channelUsername: string, messageId: number) {
  return `${channelUsername}:${messageId}`;
}
