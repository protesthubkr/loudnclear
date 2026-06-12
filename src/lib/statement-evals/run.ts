import "server-only";

import { buildStatementEvalDecision } from "./assembler";
import { buildStatementEvalCandidates } from "./candidates";
import {
  getStatementEvalLimit,
  getStatementEvalModel,
  getStatementEvalReasoningEffort,
  getStatementEvalWindowHours,
} from "./config";
import { planStatementEvalSpansWithLlm } from "./openai";
import {
  assertStatementEvalSchema,
  completeStatementEvalRun,
  createStatementEvalRun,
  failStatementEvalRun,
  getRequiredStatementEvalSupabaseClient,
  insertStatementEvalItem,
  insertStatementEvalOutput,
} from "./repository";
import { loadStatementEvalSourceRows } from "./source-loader";
import type {
  StatementEvalOutputDecision,
  StatementEvalRunOptions,
  StatementEvalRunResult,
  StatementEvalVariant,
} from "./types";
import { getStatementEvalVariants } from "./variants";

export type { StatementEvalRunOptions, StatementEvalRunResult } from "./types";

export async function runStatementEvalLab(
  options: StatementEvalRunOptions = {},
): Promise<StatementEvalRunResult> {
  const dryRun = options.dryRun ?? false;
  const limit = options.limit ?? getStatementEvalLimit();
  const windowHours = options.windowHours ?? getStatementEvalWindowHours();
  const windowEndedAt = new Date().toISOString();
  const windowStartedAt = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const variants = getStatementEvalVariants(options.variantKeys);
  const variantKeys = variants.map((variant) => variant.key);
  const supabase = getRequiredStatementEvalSupabaseClient();

  if (!dryRun) {
    await assertStatementEvalSchema({ supabase });
  }

  const rows = await loadStatementEvalSourceRows({
    cutoffIso: windowStartedAt,
    limit,
    sourceType: options.sourceType,
    summaryId: options.summaryId,
    supabase,
  });

  if (dryRun) {
    return {
      dryRun,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedTotalTokens: 0,
      failedOutputs: 0,
      itemCount: rows.length,
      outputCount: 0,
      runId: null,
      selectedOutputs: 0,
      variantKeys,
      windowHours,
    };
  }

  const runId = await createStatementEvalRun({
    itemLimit: limit,
    model: getStatementEvalModel(),
    reasoningEffort: getStatementEvalReasoningEffort(),
    sourceType: options.sourceType,
    summaryId: options.summaryId,
    supabase,
    variantKeys,
    windowEndedAt,
    windowStartedAt,
  });
  let outputCount = 0;
  let selectedOutputs = 0;
  let failedOutputs = 0;
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;
  let estimatedTotalTokens = 0;

  try {
    for (const row of rows) {
      const itemId = await insertStatementEvalItem({ row, runId, supabase });
      const candidates = buildStatementEvalCandidates(row);

      for (const variant of variants) {
        const decision =
          candidates.length === 0
            ? buildNoCandidateDecision({ variant })
            : await decideVariant({ candidates, row, variant });

        await insertStatementEvalOutput({
          decision,
          itemId,
          runId,
          supabase,
        });

        outputCount += 1;
        estimatedInputTokens += decision.estimatedInputTokens;
        estimatedOutputTokens += decision.estimatedOutputTokens;
        estimatedTotalTokens += decision.estimatedTotalTokens;

        if (decision.finalStatus === "selected") {
          selectedOutputs += 1;
        }

        if (decision.finalStatus === "failed") {
          failedOutputs += 1;
        }
      }
    }

    await completeStatementEvalRun({
      failedOutputCount: failedOutputs,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      itemCount: rows.length,
      outputCount,
      runId,
      selectedOutputCount: selectedOutputs,
      supabase,
    });
  } catch (error) {
    await failStatementEvalRun({
      errorMessage: getEvalRunErrorMessage(error),
      runId,
      supabase,
    });
    throw error;
  }

  return {
    dryRun,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    failedOutputs,
    itemCount: rows.length,
    outputCount,
    runId,
    selectedOutputs,
    variantKeys,
    windowHours,
  };
}

async function decideVariant({
  candidates,
  row,
  variant,
}: {
  candidates: ReturnType<typeof buildStatementEvalCandidates>;
  row: Parameters<typeof buildStatementEvalCandidates>[0];
  variant: StatementEvalVariant;
}) {
  try {
    const planner = await planStatementEvalSpansWithLlm({
      candidates,
      row,
      variant,
    });

    return buildStatementEvalDecision({
      candidates,
      estimatedInputTokens: planner.estimatedInputTokens,
      estimatedOutputTokens: planner.estimatedOutputTokens,
      estimatedTotalTokens: planner.estimatedTotalTokens,
      model: planner.model,
      output: planner.output,
      rawOutput: planner.rawOutput,
      reasoningEffort: planner.reasoningEffort,
      variant,
    });
  } catch (error) {
    return buildStatementEvalDecision({
      candidates,
      model: getStatementEvalModel(),
      output: null,
      rawOutput: {
        error: getEvalRunErrorMessage(error),
      },
      reasoningEffort: getStatementEvalReasoningEffort(),
      variant,
    });
  }
}

function buildNoCandidateDecision({
  variant,
}: {
  variant: StatementEvalVariant;
}): StatementEvalOutputDecision {
  return buildStatementEvalDecision({
    candidates: [],
    model: getStatementEvalModel(),
    output: null,
    rawOutput: {
      error: "no_candidates",
    },
    reasoningEffort: getStatementEvalReasoningEffort(),
    variant,
  });
}

function getEvalRunErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
