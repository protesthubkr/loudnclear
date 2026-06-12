import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  StatementEvalItemRow,
  StatementEvalOutputDecision,
  StatementEvalRunDetail,
  StatementEvalRunRow,
  StatementEvalSourceRow,
  StatementEvalSourceType,
  StatementEvalVariantKey,
} from "./types";

export function getRequiredStatementEvalSupabaseClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase statement eval configuration.");
  }

  return supabase;
}

export async function assertStatementEvalSchema({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("statement_eval_runs").select("id").limit(1);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createStatementEvalRun({
  itemLimit,
  model,
  reasoningEffort,
  sourceType,
  summaryId,
  supabase,
  variantKeys,
  windowEndedAt,
  windowStartedAt,
}: {
  itemLimit: number;
  model: string | null;
  reasoningEffort: string | null;
  sourceType?: StatementEvalSourceType;
  summaryId?: string;
  supabase: SupabaseClient;
  variantKeys: StatementEvalVariantKey[];
  windowEndedAt: string;
  windowStartedAt: string;
}) {
  const { data, error } = await supabase
    .from("statement_eval_runs")
    .insert({
      item_limit: itemLimit,
      model,
      reasoning_effort: reasoningEffort,
      source_type: sourceType ?? null,
      summary_id: summaryId ?? null,
      variant_keys: variantKeys,
      window_ended_at: windowEndedAt,
      window_started_at: windowStartedAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function insertStatementEvalItem({
  row,
  runId,
  supabase,
}: {
  row: StatementEvalSourceRow;
  runId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("statement_eval_items")
    .insert({
      current_core_sentence: row.currentCoreSentence,
      current_display_prompt_version: row.currentDisplayPromptVersion,
      current_display_sentence: row.currentDisplaySentence,
      current_display_status: row.currentDisplayStatus,
      display_at: row.displayAt,
      document_type: row.documentType,
      organization_name: row.organizationName,
      run_id: runId,
      source_key: row.sourceKey,
      source_metadata: row.sourceMetadata,
      source_summary_id: row.sourceSummaryId,
      source_type: row.sourceType,
      source_url: row.sourceUrl,
      text_snapshot: row.textSnapshot,
      title: row.title,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function insertStatementEvalOutput({
  decision,
  itemId,
  runId,
  supabase,
}: {
  decision: StatementEvalOutputDecision;
  itemId: string;
  runId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("statement_eval_outputs").insert({
    assembled_sentence: decision.assembledSentence,
    candidate_snapshot: decision.candidateSnapshot,
    cleansing_ok: decision.cleansingOk,
    cleansed_sentence: decision.cleansedSentence,
    estimated_input_tokens: decision.estimatedInputTokens,
    estimated_output_tokens: decision.estimatedOutputTokens,
    estimated_total_tokens: decision.estimatedTotalTokens,
    extractive_ok: decision.extractiveOk,
    failure_reason: decision.failureReason,
    final_status: decision.finalStatus,
    hard_gate_ok: decision.hardGateOk,
    issue_clarity: decision.issueClarity,
    issue_signal_count: decision.issueSignalCount,
    issue_text: decision.issueText,
    item_id: itemId,
    length_ok: decision.lengthOk,
    metadata_left: decision.metadataLeft,
    model: decision.model,
    planner_reason: decision.plannerReason,
    raw_planner_output: decision.rawPlannerOutput ?? {},
    reasoning_effort: decision.reasoningEffort,
    run_id: runId,
    span_plan: decision.spanPlan,
    stance_clarity: decision.stanceClarity,
    stance_signal_count: decision.stanceSignalCount,
    stance_text: decision.stanceText,
    summary_mode: decision.summaryMode,
    variant_key: decision.variant.key,
    variant_version: decision.variant.version,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function completeStatementEvalRun({
  failedOutputCount,
  estimatedInputTokens,
  estimatedOutputTokens,
  estimatedTotalTokens,
  itemCount,
  outputCount,
  runId,
  selectedOutputCount,
  supabase,
}: {
  failedOutputCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  itemCount: number;
  outputCount: number;
  runId: string;
  selectedOutputCount: number;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("statement_eval_runs")
    .update({
      failed_output_count: failedOutputCount,
      estimated_input_tokens: estimatedInputTokens,
      estimated_output_tokens: estimatedOutputTokens,
      estimated_total_tokens: estimatedTotalTokens,
      item_count: itemCount,
      output_count: outputCount,
      selected_output_count: selectedOutputCount,
      status: "completed",
    })
    .eq("id", runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function failStatementEvalRun({
  errorMessage,
  runId,
  supabase,
}: {
  errorMessage: string;
  runId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("statement_eval_runs")
    .update({
      last_error: errorMessage,
      status: "failed",
    })
    .eq("id", runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getStatementEvalRuns({
  limit = 20,
  supabase,
}: {
  limit?: number;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("statement_eval_runs")
    .select(
      [
        "id",
        "status",
        "window_started_at",
        "window_ended_at",
        "variant_keys",
        "item_count",
        "output_count",
        "selected_output_count",
        "failed_output_count",
        "estimated_input_tokens",
        "estimated_output_tokens",
        "estimated_total_tokens",
        "created_at",
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as StatementEvalRunRow[] | null) ?? []).map((run) => ({
    ...run,
    variant_keys: run.variant_keys ?? [],
  }));
}

export async function getStatementEvalRunDetail({
  runId,
  supabase,
}: {
  runId: string;
  supabase: SupabaseClient;
}): Promise<StatementEvalRunDetail | null> {
  const { data: runData, error: runError } = await supabase
    .from("statement_eval_runs")
    .select(
      [
        "id",
        "status",
        "window_started_at",
        "window_ended_at",
        "variant_keys",
        "item_count",
        "output_count",
        "selected_output_count",
        "failed_output_count",
        "estimated_input_tokens",
        "estimated_output_tokens",
        "estimated_total_tokens",
        "created_at",
      ].join(","),
    )
    .eq("id", runId)
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  if (!runData) {
    return null;
  }

  const { data: itemData, error: itemError } = await supabase
    .from("statement_eval_items")
    .select(
      [
        "id",
        "source_type",
        "source_summary_id",
        "source_key",
        "organization_name",
        "source_url",
        "title",
        "document_type",
        "display_at",
        "current_core_sentence",
        "current_display_sentence",
        "text_snapshot",
      ].join(","),
    )
    .eq("run_id", runId)
    .order("display_at", { ascending: false, nullsFirst: false });

  if (itemError) {
    throw new Error(itemError.message);
  }

  const itemIds = ((itemData as unknown as Array<{ id: string }> | null) ?? []).map(
    (item) => item.id,
  );
  const [outputs, scores] = await Promise.all([
    getStatementEvalOutputs({ itemIds, supabase }),
    getStatementEvalManualScores({ itemIds, supabase }),
  ]);

  return {
    items: ((itemData as unknown as Omit<
      StatementEvalItemRow,
      "outputs"
    >[] | null) ?? []).map(
      (item) => ({
        ...item,
        outputs: (outputs.get(item.id) ?? []).map((output) => ({
          ...output,
          manual_score: scores.get(output.id) ?? null,
        })),
      }),
    ),
    run: {
      ...(runData as unknown as StatementEvalRunRow),
      variant_keys: ((runData as unknown as StatementEvalRunRow).variant_keys ??
        []) as StatementEvalVariantKey[],
    },
  };
}

export async function upsertStatementEvalManualScore({
  cleansingScore,
  compositionScore,
  feedScore,
  isWinner,
  issueScore,
  itemId,
  notes,
  outputId,
  runId,
  stanceScore,
  supabase,
}: {
  cleansingScore?: number | null;
  compositionScore?: number | null;
  feedScore?: number | null;
  isWinner?: boolean;
  issueScore?: number | null;
  itemId: string;
  notes?: string | null;
  outputId: string;
  runId: string;
  stanceScore?: number | null;
  supabase: SupabaseClient;
}) {
  if (isWinner) {
    const { error: clearError } = await supabase
      .from("statement_eval_manual_scores")
      .update({ is_winner: false })
      .eq("run_id", runId)
      .eq("item_id", itemId)
      .neq("output_id", outputId);

    if (clearError) {
      throw new Error(clearError.message);
    }
  }

  const { error } = await supabase.from("statement_eval_manual_scores").upsert(
    {
      cleansing_score: cleansingScore ?? null,
      composition_score: compositionScore ?? null,
      feed_score: feedScore ?? null,
      is_winner: isWinner ?? false,
      issue_score: issueScore ?? null,
      item_id: itemId,
      notes: notes ?? null,
      output_id: outputId,
      run_id: runId,
      stance_score: stanceScore ?? null,
    },
    {
      onConflict: "run_id,item_id,output_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function getStatementEvalOutputs({
  itemIds,
  supabase,
}: {
  itemIds: string[];
  supabase: SupabaseClient;
}) {
  if (itemIds.length === 0) {
    return new Map<string, StatementEvalItemRow["outputs"]>();
  }

  const { data, error } = await supabase
    .from("statement_eval_outputs")
    .select(
      [
        "id",
        "item_id",
        "variant_key",
        "variant_version",
        "final_status",
        "summary_mode",
        "assembled_sentence",
        "cleansed_sentence",
        "estimated_input_tokens",
        "estimated_output_tokens",
        "estimated_total_tokens",
        "issue_text",
        "stance_text",
        "issue_clarity",
        "stance_clarity",
        "extractive_ok",
        "cleansing_ok",
        "length_ok",
        "hard_gate_ok",
        "metadata_left",
        "stance_signal_count",
        "issue_signal_count",
        "failure_reason",
        "planner_reason",
      ].join(","),
    )
    .in("item_id", itemIds)
    .order("variant_key", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const outputMap = new Map<string, StatementEvalItemRow["outputs"]>();

  for (const row of (data as unknown as Array<
    Omit<StatementEvalItemRow["outputs"][number], "manual_score"> & {
      item_id: string;
    }
  > | null) ?? []) {
    outputMap.set(row.item_id, [
      ...(outputMap.get(row.item_id) ?? []),
      { ...row, manual_score: null },
    ]);
  }

  return outputMap;
}

async function getStatementEvalManualScores({
  itemIds,
  supabase,
}: {
  itemIds: string[];
  supabase: SupabaseClient;
}) {
  if (itemIds.length === 0) {
    return new Map<string, NonNullable<StatementEvalItemRow["outputs"][number]["manual_score"]>>();
  }

  const { data, error } = await supabase
    .from("statement_eval_manual_scores")
    .select(
      [
        "item_id",
        "output_id",
        "is_winner",
        "issue_score",
        "stance_score",
        "composition_score",
        "cleansing_score",
        "feed_score",
        "notes",
      ].join(","),
    )
    .in("item_id", itemIds);

  if (error) {
    if (isOutdatedManualScoreSchemaError(error)) {
      return new Map<
        string,
        NonNullable<StatementEvalItemRow["outputs"][number]["manual_score"]>
      >();
    }

    throw new Error(error.message);
  }

  return new Map(
    ((data as unknown as Array<
      NonNullable<StatementEvalItemRow["outputs"][number]["manual_score"]> & {
        item_id: string;
      }
    > | null) ?? []).map(
      (row) => [
        row.output_id,
        {
          cleansing_score: row.cleansing_score,
          composition_score: row.composition_score,
          feed_score: row.feed_score,
          is_winner: row.is_winner,
          issue_score: row.issue_score,
          notes: row.notes,
          output_id: row.output_id,
          stance_score: row.stance_score,
        },
      ],
    ),
  );
}

function isOutdatedManualScoreSchemaError(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42703" ||
    (typeof error.message === "string" &&
      error.message.includes("statement_eval_manual_scores") &&
      error.message.includes("does not exist"))
  );
}
