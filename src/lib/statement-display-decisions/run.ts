import "server-only";

import { buildStatementDisplayCandidates } from "./candidates";
import {
  getStatementDisplayDecisionLimit,
  getStatementDisplayDecisionWindowHours,
  STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
} from "./config";
import { compareStatementDisplayDecisionWithLlm } from "./openai";
import {
  assertStatementDisplayDecisionSchema,
  buildDisplayDecisionKey,
  getExistingStatementDisplayDecisionKeys,
  getFailedStatementDisplayDecisionKeys,
  getRequiredStatementDisplayDecisionSupabaseClient,
  promoteSelectedStatementDisplaySourceSummary,
  upsertStatementDisplayDecision,
} from "./repository";
import type {
  StatementDisplayDecision,
  StatementDisplayDecisionOutcome,
  StatementDisplayDecisionRunOptions,
  StatementDisplayDecisionRunResult,
  StatementDisplaySourceRow,
} from "./types";
import { getRowsForStatementDisplayDecision } from "./source-rows";
import { validateStatementDisplayDecision } from "./validation";
import { clearPublicStatementFeedWindowCache } from "@/lib/telegram-statements/public-feed";

export type {
  StatementDisplayDecisionOutcome,
  StatementDisplayDecisionRunOptions,
  StatementDisplayDecisionRunResult,
} from "./types";

export async function runStatementDisplayDecisionPipeline(
  options: StatementDisplayDecisionRunOptions = {},
): Promise<StatementDisplayDecisionRunResult> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const retryFailed = options.retryFailed ?? false;
  const limit = options.limit ?? getStatementDisplayDecisionLimit();
  const windowHours =
    options.windowHours ?? getStatementDisplayDecisionWindowHours();
  const cutoffIso = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const supabase = getRequiredStatementDisplayDecisionSupabaseClient();
  const rows = await getRowsForStatementDisplayDecision({
    cutoffIso,
    limit,
    sourceType: options.sourceType,
    summaryId: options.summaryId,
    supabase,
  });

  if (!dryRun) {
    await assertStatementDisplayDecisionSchema({ supabase });
  }

  const existingKeys =
    dryRun || force || retryFailed
      ? new Set<string>()
      : await getExistingStatementDisplayDecisionKeys({ rows, supabase });
  const retryKeys =
    retryFailed && !dryRun
      ? await getFailedStatementDisplayDecisionKeys({ rows, supabase })
      : new Set<string>();
  const result: StatementDisplayDecisionRunResult = {
    dryRun,
    failed: 0,
    force,
    outcomes: [],
    rejected: 0,
    retryFailed,
    reviewNeeded: 0,
    rowsSeen: rows.length,
    selected: 0,
    skippedExisting: 0,
    windowHours,
  };

  for (const row of rows) {
    const rowKey = buildDisplayDecisionKey(row.sourceType, row.sourceSummaryId);

    if (retryFailed && !retryKeys.has(rowKey)) {
      result.skippedExisting += 1;
      result.outcomes.push(toOutcome(row, "skipped_existing"));
      continue;
    }

    if (existingKeys.has(rowKey)) {
      result.skippedExisting += 1;
      result.outcomes.push(toOutcome(row, "skipped_existing"));
      continue;
    }

    const candidates = buildStatementDisplayCandidates(row);

    if (dryRun) {
      result.outcomes.push({
        ...toOutcome(row, "preview"),
        candidateCount: candidates.length,
      });
      continue;
    }

    const decision = await decideStatementDisplay({ candidates, row });

    await upsertStatementDisplayDecision({
      comparatorModel: getComparatorModel(decision),
      comparatorPromptVersion: STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
      decision,
      row,
      supabase,
    });

    if (decision.status === "selected") {
      await promoteSelectedStatementDisplaySourceSummary({
        comparatorPromptVersion: STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
        decision,
        row,
        supabase,
      });
      result.selected += 1;
    } else if (decision.status === "rejected") {
      result.rejected += 1;
    } else if (decision.status === "review_needed") {
      result.reviewNeeded += 1;
    } else {
      result.failed += 1;
    }

    result.outcomes.push({
      ...toOutcome(row, decision.status),
      candidateCount: decision.candidateCount,
      displaySentence: decision.displaySentence,
      errorMessage: decision.errorMessage,
      finalStatus: decision.status,
      selectedMode: decision.comparatorOutput?.selected_mode ?? null,
      selectedSentence: decision.coreSentence,
      topicLabel: decision.comparatorOutput?.topic_label ?? null,
    });
  }

  if (!dryRun && result.outcomes.some((outcome) => outcome.status !== "skipped_existing")) {
    clearPublicStatementFeedWindowCache();
  }

  return result;
}

async function decideStatementDisplay({
  candidates,
  row,
}: {
  candidates: ReturnType<typeof buildStatementDisplayCandidates>;
  row: StatementDisplaySourceRow;
}): Promise<StatementDisplayDecision & { comparatorModel?: string }> {
  if (candidates.length === 0) {
    return failedDecision("no_sentence_candidates", candidates.length);
  }

  try {
    const comparator = await compareStatementDisplayDecisionWithLlm({
      candidates,
      row,
    });
    const validation = validateStatementDisplayDecision({
      candidates,
      output: comparator.output,
      row,
    });

    return {
      candidateCount: candidates.length,
      comparatorModel: comparator.model,
      comparatorOutput: comparator.output,
      coreSentence: validation.coreSentence,
      displaySentence: validation.displaySentence,
      errorMessage: validation.errorMessage,
      selectedCandidate: validation.candidate,
      status: validation.status,
    };
  } catch (error) {
    return failedDecision(getDisplayDecisionErrorMessage(error), candidates.length);
  }
}

function failedDecision(
  errorMessage: string,
  candidateCount: number,
): StatementDisplayDecision {
  return {
    candidateCount,
    comparatorOutput: null,
    coreSentence: null,
    displaySentence: null,
    errorMessage,
    selectedCandidate: null,
    status: "failed",
  };
}

function toOutcome(
  row: StatementDisplaySourceRow,
  status: StatementDisplayDecisionOutcome["status"],
): StatementDisplayDecisionOutcome {
  return {
    currentCoreSentence: row.currentCoreSentence,
    organizationName: row.organizationName,
    sourceKey: row.sourceKey,
    sourceSummaryId: row.sourceSummaryId,
    sourceType: row.sourceType,
    status,
  };
}

function getDisplayDecisionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getComparatorModel(
  decision: StatementDisplayDecision & { comparatorModel?: string },
) {
  return decision.comparatorModel ?? null;
}
