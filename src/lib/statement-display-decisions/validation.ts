import { getDisplayTextRejectReason } from "./candidates";
import {
  finalizeDisplaySentence,
  hasDisplayPostprocessResidue,
  normalizeGroundingText,
} from "./postprocess";
import type {
  StatementDisplayCandidate,
  StatementDisplayComparatorOutput,
  StatementDisplayDecisionFinalStatus,
  StatementDisplaySentenceRole,
  StatementDisplaySourceRow,
} from "./types";

type ValidationResult = {
  candidate: StatementDisplayCandidate | null;
  coreSentence: string | null;
  displaySentence: string | null;
  errorMessage: string | null;
  status: Exclude<StatementDisplayDecisionFinalStatus, "failed">;
};

const NON_DISPLAYABLE_SENTENCE_ROLES = new Set<StatementDisplaySentenceRole>([
  "context",
  "notice",
  "resource_intro",
]);

export function validateStatementDisplayDecision({
  candidates,
  output,
  row,
}: {
  candidates: StatementDisplayCandidate[];
  output: StatementDisplayComparatorOutput;
  row: StatementDisplaySourceRow;
}): ValidationResult {
  const candidate = findSelectedCandidate(candidates, output);
  const displaySentence = output.display_sentence
    ? finalizeDisplaySentence(output.display_sentence)
    : null;

  if (output.final_status === "rejected") {
    return {
      candidate,
      coreSentence: null,
      displaySentence: null,
      errorMessage: output.reason || "rejected_by_comparator",
      status: "rejected",
    };
  }

  if (output.final_status === "review_needed") {
    return review(output.reason || "review_needed_by_comparator", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (
    output.selected_mode !== "sentence_only" &&
    output.selected_mode !== "label_plus_sentence"
  ) {
    return review("selected_status_requires_display_mode", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (output.chosen_candidate === "none") {
    return review("selected_status_requires_chosen_candidate", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (output.subject_clarity === "missing") {
    return review("missing_subject_clarity", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (output.stance_clarity === "missing") {
    return review("missing_stance_clarity", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (
    output.sentence_role &&
    NON_DISPLAYABLE_SENTENCE_ROLES.has(output.sentence_role)
  ) {
    return review("non_displayable_role_needs_review", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (!displaySentence) {
    return review("missing_display_sentence", {
      candidate,
      displaySentence,
      output,
    });
  }

  const unusableDisplayReason = getDisplayTextRejectReason(displaySentence);

  if (unusableDisplayReason) {
    return review(`display_${unusableDisplayReason}`, {
      candidate,
      displaySentence,
      output,
    });
  }

  if (hasDisplayPostprocessResidue(displaySentence)) {
    return review("display_postprocess_residue", {
      candidate,
      displaySentence,
      output,
    });
  }

  if (!isGroundedDisplaySentence({ candidates, displaySentence, row })) {
    return review("display_sentence_not_grounded", {
      candidate,
      displaySentence,
      output,
    });
  }

  return selected({ candidate, displaySentence, output });
}

function selected({
  candidate,
  displaySentence,
  output,
}: {
  candidate: StatementDisplayCandidate | null;
  displaySentence: string;
  output: StatementDisplayComparatorOutput;
}): ValidationResult {
  return {
    candidate,
    coreSentence: finalizeDisplaySentence(
      output.core_sentence ?? candidate?.text ?? displaySentence,
    ),
    displaySentence,
    errorMessage: null,
    status: "selected",
  };
}

function review(
  errorMessage: string,
  {
    candidate,
    displaySentence,
    output,
  }: {
    candidate: StatementDisplayCandidate | null;
    displaySentence: string | null;
    output: StatementDisplayComparatorOutput;
  },
): ValidationResult {
  return {
    candidate,
    coreSentence: output.core_sentence
      ? finalizeDisplaySentence(output.core_sentence)
      : candidate?.text ?? null,
    displaySentence,
    errorMessage,
    status: "review_needed",
  };
}

function findSelectedCandidate(
  candidates: StatementDisplayCandidate[],
  output: StatementDisplayComparatorOutput,
) {
  const selectedSentenceId =
    output.selected_sentence_id ??
    getPrimarySourceIdForChosenCandidate(output);

  if (!selectedSentenceId) {
    return null;
  }

  return (
    candidates.find((candidate) => candidate.id === selectedSentenceId) ?? null
  );
}

function getPrimarySourceIdForChosenCandidate(
  output: StatementDisplayComparatorOutput,
) {
  if (output.chosen_candidate === "A") {
    return output.candidate_a_source_ids[0] ?? null;
  }

  if (output.chosen_candidate === "C") {
    return output.candidate_c_source_ids[0] ?? null;
  }

  return null;
}

function isGroundedDisplaySentence({
  candidates,
  displaySentence,
  row,
}: {
  candidates: StatementDisplayCandidate[];
  displaySentence: string;
  row: StatementDisplaySourceRow;
}) {
  const sourceTexts = [
    row.title ?? "",
    row.textSnapshot,
    ...candidates.map((candidate) => candidate.text),
  ]
    .map(normalizeGroundingText)
    .filter(Boolean);
  const pieces = splitDisplayIntoGroundingPieces(displaySentence)
    .map(normalizeGroundingText)
    .filter((piece) => piece.length >= 6);

  if (pieces.length === 0) {
    return false;
  }

  return pieces.every((piece) =>
    sourceTexts.some((sourceText) => sourceText.includes(piece)),
  );
}

function splitDisplayIntoGroundingPieces(text: string) {
  return text
    .split(/(?<=[.!?。！？…])\s+/u)
    .map((piece) => piece.trim())
    .filter(Boolean);
}
