import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";
import type { StatementEvalSourceRow, StatementEvalSourceType } from "./types";

const DEFAULT_SOURCE_TYPES: StatementEvalSourceType[] = [
  "telegram",
  "party",
  "web",
];

type SourceLoadOptions = {
  cutoffIso: string;
  limit: number;
  sourceType?: StatementEvalSourceType;
  summaryId?: string;
  supabase: SupabaseClient;
};

export async function loadStatementEvalSourceRows({
  cutoffIso,
  limit,
  sourceType,
  summaryId,
  supabase,
}: SourceLoadOptions) {
  const sourceTypes = sourceType ? [sourceType] : DEFAULT_SOURCE_TYPES;
  const rows = (
    await Promise.all(
      sourceTypes.map((type) =>
        loadSourceRowsByType({
          cutoffIso,
          limit,
          sourceType: type,
          summaryId,
          supabase,
        }),
      ),
    )
  )
    .flat()
    .filter((row) => row.textSnapshot.trim())
    .sort(compareSourceRowsByDisplayAtDesc)
    .slice(0, limit);

  return attachCurrentDisplayDecisions({ rows, supabase });
}

async function loadSourceRowsByType({
  cutoffIso,
  limit,
  sourceType,
  summaryId,
  supabase,
}: SourceLoadOptions & { sourceType: StatementEvalSourceType }) {
  switch (sourceType) {
    case "party":
      return getPartyRows({ cutoffIso, limit, summaryId, supabase });
    case "telegram":
      return getTelegramRows({ cutoffIso, limit, summaryId, supabase });
    case "web":
      return getWebRows({ cutoffIso, limit, summaryId, supabase });
    case "x":
      return getXRows({ cutoffIso, limit, summaryId, supabase });
  }
}

async function getTelegramRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceLoadOptions) {
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
      ].join(","),
    )
    .eq("status", "extracted")
    .order("message_created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  query = summaryId ? query.eq("id", summaryId) : query.gte("message_created_at", cutoffIso);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    channel_username: string;
    core_sentence: string | null;
    document_type: TelegramStatementDocumentType;
    id: string;
    message_created_at: string | null;
    message_id: number;
    organization_name: string;
    source_url: string;
    status: string;
  }> | null) ?? [];
  const textSnapshots = await getTelegramTextSnapshots({ rows, supabase });

  return rows.map((row): StatementEvalSourceRow => ({
    currentCoreSentence: row.core_sentence,
    currentDisplayPromptVersion: null,
    currentDisplaySentence: null,
    currentDisplayStatus: null,
    displayAt: row.message_created_at,
    documentType: row.document_type,
    organizationName: row.organization_name,
    sourceKey: row.channel_username,
    sourceMetadata: {
      message_id: row.message_id,
    },
    sourceSummaryId: row.id,
    sourceType: "telegram",
    sourceUrl: row.source_url,
    textSnapshot:
      textSnapshots.get(`${row.channel_username}:${row.message_id}`) ?? "",
    title: null,
  }));
}

async function getPartyRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceLoadOptions) {
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
      ].join(","),
    )
    .eq("status", "extracted")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  query = summaryId ? query.eq("id", summaryId) : query.gte("published_at", cutoffIso);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    core_sentence: string | null;
    document_id: string;
    document_type: TelegramStatementDocumentType;
    id: string;
    organization_name: string;
    published_at: string | null;
    source_key: string;
    source_url: string;
    status: string;
    title: string | null;
  }> | null) ?? [];
  const textSnapshots = await getDocumentTextSnapshots({
    documentIds: rows.map((row) => row.document_id),
    documentTable: "party_statement_documents",
    supabase,
  });

  return rows.map((row): StatementEvalSourceRow => ({
    currentCoreSentence: row.core_sentence,
    currentDisplayPromptVersion: null,
    currentDisplaySentence: null,
    currentDisplayStatus: null,
    displayAt: row.published_at,
    documentType: row.document_type,
    organizationName: row.organization_name,
    sourceKey: row.source_key,
    sourceMetadata: {
      document_id: row.document_id,
    },
    sourceSummaryId: row.id,
    sourceType: "party",
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.document_id) ?? "",
    title: row.title,
  }));
}

async function getWebRows({
  cutoffIso,
  limit,
  summaryId,
  supabase,
}: SourceLoadOptions) {
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
      ].join(","),
    )
    .eq("status", "extracted")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  query = summaryId ? query.eq("id", summaryId) : query.gte("published_at", cutoffIso);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    core_sentence: string | null;
    document_id: string;
    document_type: TelegramStatementDocumentType;
    id: string;
    organization_name: string;
    published_at: string | null;
    source_key: string;
    source_url: string;
    status: string;
    title: string | null;
  }> | null) ?? [];
  const textSnapshots = await getDocumentTextSnapshots({
    documentIds: rows.map((row) => row.document_id),
    documentTable: "web_statement_documents",
    supabase,
  });

  return rows.map((row): StatementEvalSourceRow => ({
    currentCoreSentence: row.core_sentence,
    currentDisplayPromptVersion: null,
    currentDisplaySentence: null,
    currentDisplayStatus: null,
    displayAt: row.published_at,
    documentType: row.document_type,
    organizationName: row.organization_name,
    sourceKey: row.source_key,
    sourceMetadata: {
      document_id: row.document_id,
    },
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
}: SourceLoadOptions) {
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
      ].join(","),
    )
    .eq("status", "extracted")
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  query = summaryId ? query.eq("id", summaryId) : query.gte("posted_at", cutoffIso);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as Array<{
    core_sentence: string | null;
    document_type: TelegramStatementDocumentType;
    id: string;
    organization_name: string;
    post_id: string;
    posted_at: string | null;
    source_key: string;
    source_url: string;
    status: string;
  }> | null) ?? [];
  const textSnapshots = await getDocumentTextSnapshots({
    documentIds: rows.map((row) => row.post_id),
    documentTable: "x_statement_posts",
    supabase,
  });

  return rows.map((row): StatementEvalSourceRow => ({
    currentCoreSentence: row.core_sentence,
    currentDisplayPromptVersion: null,
    currentDisplaySentence: null,
    currentDisplayStatus: null,
    displayAt: row.posted_at,
    documentType: row.document_type,
    organizationName: row.organization_name,
    sourceKey: row.source_key,
    sourceMetadata: {
      post_id: row.post_id,
    },
    sourceSummaryId: row.id,
    sourceType: "x",
    sourceUrl: row.source_url,
    textSnapshot: textSnapshots.get(row.post_id) ?? "",
    title: null,
  }));
}

async function attachCurrentDisplayDecisions({
  rows,
  supabase,
}: {
  rows: StatementEvalSourceRow[];
  supabase: SupabaseClient;
}) {
  if (rows.length === 0) {
    return rows;
  }

  const { data, error } = await supabase
    .from("statement_display_decisions")
    .select(
      [
        "source_type",
        "source_summary_id",
        "final_status",
        "display_sentence",
        "core_sentence",
        "comparator_prompt_version",
        "created_at",
      ].join(","),
    )
    .in(
      "source_summary_id",
      rows.map((row) => row.sourceSummaryId),
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const displayMap = new Map<
    string,
    {
      comparator_prompt_version: string | null;
      core_sentence: string | null;
      display_sentence: string | null;
      final_status: string | null;
    }
  >();

  for (const row of (data as unknown as Array<{
    comparator_prompt_version: string | null;
    core_sentence: string | null;
    display_sentence: string | null;
    final_status: string | null;
    source_summary_id: string;
    source_type: StatementEvalSourceType;
  }> | null) ?? []) {
    const key = `${row.source_type}:${row.source_summary_id}`;

    if (!displayMap.has(key)) {
      displayMap.set(key, row);
    }
  }

  return rows.map((row) => {
    const current = displayMap.get(`${row.sourceType}:${row.sourceSummaryId}`);

    if (!current) {
      return row;
    }

    return {
      ...row,
      currentCoreSentence: current.core_sentence ?? row.currentCoreSentence,
      currentDisplayPromptVersion: current.comparator_prompt_version,
      currentDisplaySentence: current.display_sentence,
      currentDisplayStatus: current.final_status,
    };
  });
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
    ((data as unknown as Array<{
      channel_username: string;
      message_id: number;
      text_snapshot: string | null;
    }> | null) ?? []).map((row) => [
      `${row.channel_username}:${row.message_id}`,
      row.text_snapshot ?? "",
    ]),
  );
}

async function getDocumentTextSnapshots({
  documentIds,
  documentTable,
  supabase,
}: {
  documentIds: string[];
  documentTable:
    | "party_statement_documents"
    | "web_statement_documents"
    | "x_statement_posts";
  supabase: SupabaseClient;
}) {
  const ids = [...new Set(documentIds)];

  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from(documentTable)
    .select("id,text_snapshot")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data as unknown as Array<{ id: string; text_snapshot: string | null }> | null) ?? []).map(
      (row) => [row.id, row.text_snapshot ?? ""],
    ),
  );
}

function compareSourceRowsByDisplayAtDesc(
  left: StatementEvalSourceRow,
  right: StatementEvalSourceRow,
) {
  const leftTime = left.displayAt ? Date.parse(left.displayAt) : 0;
  const rightTime = right.displayAt ? Date.parse(right.displayAt) : 0;

  return rightTime - leftTime;
}
