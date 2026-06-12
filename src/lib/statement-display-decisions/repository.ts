import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { STATEMENT_DISPLAY_DECISION_PROMPT_VERSION } from "./config";
import type {
  StatementDisplayDecision,
  StatementDisplayDecisionSourceType,
  StatementDisplayFeedDecision,
  StatementDisplaySourceRow,
} from "./types";

export function getRequiredStatementDisplayDecisionSupabaseClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase statement display decision configuration.");
  }

  return supabase;
}

export async function assertStatementDisplayDecisionSchema({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("statement_display_decisions")
    .select("id")
    .limit(1);

  if (!error) {
    return;
  }

  throw new Error(error.message);
}

export async function getExistingStatementDisplayDecisionKeys({
  rows,
  supabase,
}: {
  rows: StatementDisplaySourceRow[];
  supabase: SupabaseClient;
}) {
  if (rows.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("statement_display_decisions")
    .select("source_type,source_summary_id")
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION)
    .in(
      "source_summary_id",
      rows.map((row) => row.sourceSummaryId),
    );

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data as Array<{
      source_summary_id: string;
      source_type: StatementDisplayDecisionSourceType;
    }> | null) ?? []).map((row) =>
      buildDisplayDecisionKey(row.source_type, row.source_summary_id),
    ),
  );
}

export async function getFailedStatementDisplayDecisionKeys({
  rows,
  supabase,
}: {
  rows: StatementDisplaySourceRow[];
  supabase: SupabaseClient;
}) {
  if (rows.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("statement_display_decisions")
    .select("source_type,source_summary_id")
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION)
    .eq("final_status", "failed")
    .in(
      "source_summary_id",
      rows.map((row) => row.sourceSummaryId),
    );

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    ((data as Array<{
      source_summary_id: string;
      source_type: StatementDisplayDecisionSourceType;
    }> | null) ?? []).map((row) =>
      buildDisplayDecisionKey(row.source_type, row.source_summary_id),
    ),
  );
}

export async function upsertStatementDisplayDecision({
  comparatorModel,
  comparatorPromptVersion,
  decision,
  row,
  supabase,
}: {
  comparatorModel: string | null;
  comparatorPromptVersion: string;
  decision: StatementDisplayDecision;
  row: StatementDisplaySourceRow;
  supabase: SupabaseClient;
}) {
  const output = decision.comparatorOutput;
  const { error } = await supabase.from("statement_display_decisions").upsert(
    {
      candidate_count: decision.candidateCount,
      comparator_model: comparatorModel,
      comparator_prompt_version: comparatorPromptVersion,
      comparator_reason: output?.reason ?? null,
      confidence: output?.confidence ?? null,
      core_sentence: decision.coreSentence,
      current_core_sentence: row.currentCoreSentence,
      current_extraction_confidence: row.currentExtractionConfidence,
      current_extraction_reason: row.currentExtractionReason,
      current_model: row.currentModel,
      current_status: row.currentStatus,
      display_at: row.displayAt,
      display_sentence: decision.displaySentence,
      document_type: row.documentType,
      final_status: decision.status,
      last_error: decision.errorMessage,
      organization_name: row.organizationName,
      raw_comparator_output: output ?? {},
      selected_mode: output?.selected_mode ?? null,
      selected_sentence_id: decision.selectedCandidate?.id ?? null,
      sentence_role: output?.sentence_role ?? null,
      source_key: row.sourceKey,
      source_summary_id: row.sourceSummaryId,
      source_type: row.sourceType,
      source_url: row.sourceUrl,
      stance_action: output?.stance_action ?? null,
      stance_clarity: output?.stance_clarity ?? null,
      subject_clarity: output?.subject_clarity ?? null,
      target_subject: output?.target_subject ?? null,
      title: row.title,
      topic_label: output?.topic_label ?? null,
    },
    {
      onConflict: "source_type,source_summary_id,comparator_prompt_version",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSelectedStatementDisplayDecisionMap({
  sourceType,
  summaryIds,
  supabase,
}: {
  sourceType: StatementDisplayDecisionSourceType;
  summaryIds: string[];
  supabase: SupabaseClient;
}) {
  if (summaryIds.length === 0) {
    return new Map<string, StatementDisplayFeedDecision>();
  }

  const { data, error } = await supabase
    .from("statement_display_decisions")
    .select("source_type,source_summary_id,core_sentence,display_sentence,topic_label")
    .eq("source_type", sourceType)
    .eq("final_status", "selected")
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION)
    .in("source_summary_id", summaryIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data as Array<{
      core_sentence: string | null;
      display_sentence: string | null;
      source_summary_id: string;
      source_type: StatementDisplayDecisionSourceType;
      topic_label: string | null;
    }> | null) ?? [])
      .filter((row) => row.core_sentence && row.display_sentence)
      .map((row) => [
        row.source_summary_id,
        {
          coreSentence: row.core_sentence as string,
          displaySentence: row.display_sentence as string,
          sourceSummaryId: row.source_summary_id,
          sourceType: row.source_type,
          topicLabel: row.topic_label,
        },
      ]),
  );
}

export function buildDisplayDecisionKey(
  sourceType: StatementDisplayDecisionSourceType,
  sourceSummaryId: string,
) {
  return `${sourceType}:${sourceSummaryId}`;
}
