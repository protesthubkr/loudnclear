import type {
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionFinalStatus,
  StatementSentenceSelectorOutput,
  StatementSentenceVerifierOutput,
} from "./types";
import {
  getUnusableCandidateReason,
  hasStanceAction,
  NON_DISPLAYABLE_SENTENCE_ROLES,
} from "./heuristics";

type ValidationResult = {
  errorMessage: string | null;
  status: Exclude<StatementSentenceSelectionFinalStatus, "failed">;
};

export function validateStatementSentenceSelection({
  candidate,
  selector,
  verifier,
}: {
  candidate: StatementSentenceSelectionCandidate;
  selector: StatementSentenceSelectorOutput;
  verifier: StatementSentenceVerifierOutput;
}): ValidationResult {
  const unusableReason = getUnusableCandidateReason(candidate.text);

  if (unusableReason) {
    return reject(unusableReason);
  }

  if (!selector.displayable) {
    return reject("selector_not_displayable");
  }

  if (!verifier.displayable) {
    return reject("verifier_not_displayable");
  }

  if (
    NON_DISPLAYABLE_SENTENCE_ROLES.has(selector.sentence_role) ||
    NON_DISPLAYABLE_SENTENCE_ROLES.has(verifier.sentence_role)
  ) {
    return review("non_displayable_role_needs_review");
  }

  if (
    !hasStanceAction(candidate.text) &&
    (!selector.stance_action || !verifier.stance_action)
  ) {
    return review("weak_stance_signal");
  }

  return {
    errorMessage: null,
    status: "selected" as const,
  };
}

function reject(errorMessage: string): ValidationResult {
  return {
    errorMessage,
    status: "rejected" as const,
  };
}

function review(errorMessage: string): ValidationResult {
  return {
    errorMessage,
    status: "review_needed" as const,
  };
}
