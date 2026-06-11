import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";
import type {
  WebStatementDocument,
  WebStatementSourceDefinition,
  WebStatementSourceKey,
} from "./types";

export type WebStatementSummaryRow = {
  attempt_count: number;
  document_id: string;
  document_type: TelegramStatementDocumentType;
  id: string;
  organization_name: string;
  published_at: string | null;
  source_key: WebStatementSourceKey;
  source_url: string;
  status: "pending" | "extracted" | "skipped" | "failed";
  title: string;
};

export function getRequiredWebStatementSupabaseClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase admin configuration.");
  }

  return supabase;
}

export async function upsertWebStatementSource({
  source,
  supabase,
}: {
  source: WebStatementSourceDefinition;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("web_statement_sources").upsert(
    {
      enabled: true,
      list_url: source.listUrl,
      organization_name: source.organizationName,
      source_key: source.sourceKey,
      source_url: source.sourceUrl,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "source_key",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWebStatementSourceScanFinished({
  errorMessage,
  sourceKey,
  supabase,
}: {
  errorMessage?: string;
  sourceKey: WebStatementSourceKey;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("web_statement_sources")
    .update({
      last_error: errorMessage ?? null,
      last_scanned_at: now,
      updated_at: now,
    })
    .eq("source_key", sourceKey);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertWebStatementDocument({
  document,
  supabase,
}: {
  document: WebStatementDocument;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("web_statement_documents")
    .upsert(
      {
        document_type: document.documentType,
        external_id: document.externalId,
        last_seen_at: now,
        organization_name: document.organizationName,
        published_at: document.publishedAt,
        raw_payload: {
          rawCategory: document.rawCategory,
          title: document.title,
        },
        source_key: document.sourceKey,
        source_url: document.sourceUrl,
        text_snapshot: document.textSnapshot,
        title: document.title,
        updated_at: now,
      },
      {
        onConflict: "source_key,external_id",
      },
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to upsert web statement.");
  }

  return data.id as string;
}

export async function upsertWebStatementSummaryCandidate({
  document,
  documentId,
  supabase,
}: {
  document: WebStatementDocument;
  documentId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("web_statement_summaries").upsert(
    {
      document_id: documentId,
      document_type: document.documentType,
      external_id: document.externalId,
      organization_name: document.organizationName,
      published_at: document.publishedAt,
      source_key: document.sourceKey,
      source_url: document.sourceUrl,
      status: "pending",
      title: document.title,
      updated_at: now,
    },
    {
      ignoreDuplicates: true,
      onConflict: "source_key,external_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return getWebStatementSummaryByExternalId({
    externalId: document.externalId,
    sourceKey: document.sourceKey,
    supabase,
  });
}

export async function getWebStatementDocumentText({
  documentId,
  supabase,
}: {
  documentId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("web_statement_documents")
    .select("text_snapshot")
    .eq("id", documentId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as { text_snapshot: string }).text_snapshot;
}

export async function markWebStatementExtractionAttemptStarted({
  attemptCount,
  summaryId,
  supabase,
}: {
  attemptCount: number;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("web_statement_summaries")
    .update({
      attempt_count: attemptCount + 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWebStatementSummaryExtracted({
  confidence,
  coreSentence,
  coreSentenceEnd,
  coreSentenceStart,
  documentType,
  model,
  promptVersion,
  reason,
  summaryId,
  supabase,
}: {
  confidence: number;
  coreSentence: string;
  coreSentenceEnd: number;
  coreSentenceStart: number;
  documentType: TelegramStatementDocumentType;
  model: string;
  promptVersion: string;
  reason: string;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("web_statement_summaries")
    .update({
      core_sentence: coreSentence,
      core_sentence_end: coreSentenceEnd,
      core_sentence_start: coreSentenceStart,
      document_type: documentType,
      extracted_at: now,
      extraction_confidence: confidence,
      extraction_reason: reason,
      last_error: null,
      model,
      prompt_version: promptVersion,
      status: "extracted",
      updated_at: now,
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWebStatementSummarySkipped({
  errorMessage,
  model,
  promptVersion,
  summaryId,
  supabase,
}: {
  errorMessage: string;
  model?: string;
  promptVersion?: string;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("web_statement_summaries")
    .update({
      extracted_at: now,
      last_error: errorMessage,
      model: model ?? null,
      prompt_version: promptVersion ?? null,
      status: "skipped",
      updated_at: now,
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWebStatementSummaryFailed({
  errorMessage,
  summaryId,
  supabase,
}: {
  errorMessage: string;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("web_statement_summaries")
    .update({
      last_error: errorMessage,
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

async function getWebStatementSummaryByExternalId({
  externalId,
  sourceKey,
  supabase,
}: {
  externalId: string;
  sourceKey: WebStatementSourceKey;
  supabase: SupabaseClient;
}) {
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
        "status",
        "attempt_count",
      ].join(","),
    )
    .eq("source_key", sourceKey)
    .eq("external_id", externalId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as WebStatementSummaryRow;
}
