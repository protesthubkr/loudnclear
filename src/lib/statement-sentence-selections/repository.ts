import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION,
  STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION,
} from "./config";
import type {
  StatementSentenceSelectionDecision,
  StatementSentenceSelectionRow,
  StatementSentenceSelectionSourceType,
} from "./types";

export function getRequiredStatementSentenceSelectionSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase statement sentence selection configuration.");
  }

  return createStatementSentenceSelectionClient(url, serviceRoleKey);
}

export async function assertStatementSentenceSelectionSchema({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("statement_sentence_llm_selections")
    .select("id")
    .limit(1);

  if (!error) {
    return;
  }

  throw new Error(error.message);
}

export async function getExistingStatementSentenceSelectionKeys({
  rows,
  supabase,
}: {
  rows: StatementSentenceSelectionRow[];
  supabase: SupabaseClient;
}) {
  if (rows.length === 0) {
    return new Set<string>();
  }

  const summaryIds = rows.map((row) => row.sourceSummaryId);
  const { data, error } = await supabase
    .from("statement_sentence_llm_selections")
    .select("source_type,source_summary_id")
    .eq("selector_prompt_version", STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION)
    .eq("verifier_prompt_version", STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION)
    .in("source_summary_id", summaryIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data as Array<{
      source_summary_id: string;
      source_type: StatementSentenceSelectionSourceType;
    }> | null) ?? []).map((row) =>
      buildSelectionKey(row.source_type, row.source_summary_id),
    ),
  );
}

export async function upsertStatementSentenceSelection({
  decision,
  row,
  selectorModel,
  selectorPromptVersion,
  verifierModel,
  verifierPromptVersion,
  supabase,
}: {
  decision: StatementSentenceSelectionDecision;
  row: StatementSentenceSelectionRow;
  selectorModel: string | null;
  selectorPromptVersion: string;
  verifierModel: string | null;
  verifierPromptVersion: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("statement_sentence_llm_selections").upsert(
    {
      candidate_count: decision.candidateCount,
      current_core_sentence: row.currentCoreSentence,
      current_extraction_confidence: row.currentExtractionConfidence,
      current_extraction_reason: row.currentExtractionReason,
      current_model: row.currentModel,
      current_status: row.currentStatus,
      display_at: row.displayAt,
      document_type: row.documentType,
      final_status: decision.status,
      last_error: decision.errorMessage,
      organization_name: row.organizationName,
      raw_selector_output: decision.selectorOutput ?? {},
      raw_verifier_output: decision.verifierOutput ?? {},
      selected_sentence: decision.selectedCandidate?.text ?? null,
      selected_sentence_id: decision.selectedCandidate?.id ?? null,
      selector_confidence: decision.selectorOutput?.confidence ?? null,
      selector_displayable: decision.selectorOutput?.displayable ?? null,
      selector_is_target_document:
        decision.selectorOutput?.is_target_document ?? null,
      selector_model: selectorModel,
      selector_prompt_version: selectorPromptVersion,
      selector_reason: decision.selectorOutput?.reason ?? null,
      selector_sentence_role: decision.selectorOutput?.sentence_role ?? null,
      selector_stance_action: decision.selectorOutput?.stance_action ?? null,
      selector_target_subject: decision.selectorOutput?.target_subject ?? null,
      source_key: row.sourceKey,
      source_summary_id: row.sourceSummaryId,
      source_type: row.sourceType,
      source_url: row.sourceUrl,
      title: row.title,
      verifier_confidence: decision.verifierOutput?.confidence ?? null,
      verifier_displayable: decision.verifierOutput?.displayable ?? null,
      verifier_model: verifierModel,
      verifier_prompt_version: verifierPromptVersion,
      verifier_reason: decision.verifierOutput?.reason ?? null,
      verifier_sentence_role: decision.verifierOutput?.sentence_role ?? null,
      verifier_stance_action: decision.verifierOutput?.stance_action ?? null,
      verifier_target_subject: decision.verifierOutput?.target_subject ?? null,
    },
    {
      onConflict:
        "source_type,source_summary_id,selector_prompt_version,verifier_prompt_version",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function buildSelectionKey(
  sourceType: StatementSentenceSelectionSourceType,
  sourceSummaryId: string,
) {
  return `${sourceType}:${sourceSummaryId}`;
}

function createStatementSentenceSelectionClient(
  url: string,
  serviceRoleKey: string,
) {
  // Keep this module independent from the existing clients so it can be used
  // without changing the production feed path.
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
