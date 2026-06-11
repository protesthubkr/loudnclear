import "server-only";

import {
  getStatementSentenceSelectionLimit,
  getStatementSentenceSelectionWindowHours,
  STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION,
  STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION,
} from "./config";
import { buildStatementSentenceCandidates } from "./candidates";
import {
  selectStatementSentenceWithLlm,
  verifyStatementSentenceWithLlm,
} from "./openai";
import {
  assertStatementSentenceSelectionSchema,
  buildSelectionKey,
  getExistingStatementSentenceSelectionKeys,
  getRequiredStatementSentenceSelectionSupabaseClient,
  upsertStatementSentenceSelection,
} from "./repository";
import { getRowsForStatementSentenceSelection } from "./repository-source-rows";
import type {
  StatementSentenceSelectionDecision,
  StatementSentenceSelectionOutcome,
  StatementSentenceSelectionRow,
  StatementSentenceSelectionRunOptions,
  StatementSentenceSelectionRunResult,
} from "./types";
import { validateStatementSentenceSelection } from "./validation";

export type {
  StatementSentenceSelectionOutcome,
  StatementSentenceSelectionRunOptions,
  StatementSentenceSelectionRunResult,
} from "./types";

export async function runStatementSentenceSelectionComparison(
  options: StatementSentenceSelectionRunOptions = {},
): Promise<StatementSentenceSelectionRunResult> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const limit = options.limit ?? getStatementSentenceSelectionLimit();
  const windowHours =
    options.windowHours ?? getStatementSentenceSelectionWindowHours();
  const cutoffIso = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const supabase = getRequiredStatementSentenceSelectionSupabaseClient();
  const rows = await getRowsForStatementSentenceSelection({
    cutoffIso,
    limit,
    sourceType: options.sourceType,
    summaryId: options.summaryId,
    supabase,
  });

  if (!dryRun) {
    await assertStatementSentenceSelectionSchema({ supabase });
  }

  const existingKeys =
    dryRun || force
      ? new Set<string>()
      : await getExistingStatementSentenceSelectionKeys({ rows, supabase });
  const result: StatementSentenceSelectionRunResult = {
    dryRun,
    failed: 0,
    force,
    outcomes: [],
    rejected: 0,
    reviewNeeded: 0,
    rowsSeen: rows.length,
    selected: 0,
    skippedExisting: 0,
    windowHours,
  };

  for (const row of rows) {
    if (existingKeys.has(buildSelectionKey(row.sourceType, row.sourceSummaryId))) {
      result.skippedExisting += 1;
      result.outcomes.push(toOutcome(row, "skipped_existing"));
      continue;
    }

    const candidates = buildStatementSentenceCandidates(row);

    if (dryRun) {
      result.outcomes.push({
        ...toOutcome(row, "preview"),
        candidateCount: candidates.length,
      });
      continue;
    }

    const decision = await selectAndVerifyStatementSentence({
      candidates,
      row,
    });

    await upsertStatementSentenceSelection({
      decision,
      row,
      selectorModel: getSelectorModel(decision),
      selectorPromptVersion: STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION,
      supabase,
      verifierModel: getVerifierModel(decision),
      verifierPromptVersion: STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION,
    });

    if (decision.status === "selected") {
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
      errorMessage: decision.errorMessage,
      finalStatus: decision.status,
      selectedSentence: decision.selectedCandidate?.text ?? null,
      verifierDisplayable: decision.verifierOutput?.displayable ?? null,
    });
  }

  return result;
}

async function selectAndVerifyStatementSentence({
  candidates,
  row,
}: {
  candidates: ReturnType<typeof buildStatementSentenceCandidates>;
  row: StatementSentenceSelectionRow;
}): Promise<
  StatementSentenceSelectionDecision & {
    selectorModel?: string;
    verifierModel?: string;
  }
> {
  if (candidates.length === 0) {
    return failedDecision("no_sentence_candidates", candidates.length);
  }

  try {
    const selector = await selectStatementSentenceWithLlm({ candidates, row });

    if (
      !selector.output.is_target_document ||
      !selector.output.selected_sentence_id
    ) {
      return {
        candidateCount: candidates.length,
        errorMessage: selector.output.reason || "not_target_document",
        selectedCandidate: null,
        selectorModel: selector.model,
        selectorOutput: selector.output,
        status: "rejected",
        verifierOutput: null,
      };
    }

    const selectedSentenceId = normalizeSelectedSentenceId(
      selector.output.selected_sentence_id,
    );
    const selectedCandidate = candidates.find(
      (candidate) => candidate.id === selectedSentenceId,
    );

    if (!selectedCandidate) {
      return {
        candidateCount: candidates.length,
        errorMessage: "invalid_selected_sentence_id",
        selectedCandidate: null,
        selectorModel: selector.model,
        selectorOutput: selector.output,
        status: "failed",
        verifierOutput: null,
      };
    }

    const verifier = await verifyStatementSentenceWithLlm({
      candidate: selectedCandidate,
      row,
    });
    const validation = validateStatementSentenceSelection({
      candidate: selectedCandidate,
      selector: selector.output,
      verifier: verifier.output,
    });

    return {
      candidateCount: candidates.length,
      errorMessage: validation.errorMessage,
      selectedCandidate,
      selectorModel: selector.model,
      selectorOutput: selector.output,
      status: validation.status,
      verifierModel: verifier.model,
      verifierOutput: verifier.output,
    };
  } catch (error) {
    return failedDecision(getSelectionErrorMessage(error), candidates.length);
  }
}

function failedDecision(
  errorMessage: string,
  candidateCount: number,
): StatementSentenceSelectionDecision {
  return {
    candidateCount,
    errorMessage,
    selectedCandidate: null,
    selectorOutput: null,
    status: "failed",
    verifierOutput: null,
  };
}

function toOutcome(
  row: StatementSentenceSelectionRow,
  status: StatementSentenceSelectionOutcome["status"],
): StatementSentenceSelectionOutcome {
  return {
    currentCoreSentence: row.currentCoreSentence,
    organizationName: row.organizationName,
    sourceKey: row.sourceKey,
    sourceSummaryId: row.sourceSummaryId,
    sourceType: row.sourceType,
    status,
  };
}

function getSelectionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getSelectorModel(
  decision: StatementSentenceSelectionDecision & { selectorModel?: string },
) {
  return decision.selectorModel ?? null;
}

function getVerifierModel(
  decision: StatementSentenceSelectionDecision & { verifierModel?: string },
) {
  return decision.verifierModel ?? null;
}

function normalizeSelectedSentenceId(value: string | null) {
  return value?.match(/[TB]\d+/i)?.[0].toUpperCase() ?? null;
}
