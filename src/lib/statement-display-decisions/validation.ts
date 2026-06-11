import {
  getUnusableCandidateReason,
  hasStanceAction,
  NON_DISPLAYABLE_SENTENCE_ROLES,
} from "@/lib/statement-sentence-selections/heuristics";
import type {
  StatementDisplayComparatorOutput,
  StatementDisplayDecisionFinalStatus,
  StatementSentenceSelectionCandidate,
} from "./types";

type ValidationResult = {
  candidate: StatementSentenceSelectionCandidate | null;
  coreSentence: string | null;
  displaySentence: string | null;
  errorMessage: string | null;
  status: Exclude<StatementDisplayDecisionFinalStatus, "failed">;
};

export function validateStatementDisplayDecision({
  candidates,
  output,
}: {
  candidates: StatementSentenceSelectionCandidate[];
  output: StatementDisplayComparatorOutput;
}): ValidationResult {
  if (output.final_status === "rejected") {
    return {
      candidate: null,
      coreSentence: null,
      displaySentence: null,
      errorMessage: output.reason || "rejected_by_comparator",
      status: "rejected",
    };
  }

  if (output.final_status === "review_needed") {
    return review(output.reason || "review_needed_by_comparator", {
      candidate: findSelectedCandidate(candidates, output.selected_sentence_id),
      output,
    });
  }

  if (
    output.selected_mode !== "sentence_only" &&
    output.selected_mode !== "label_plus_sentence"
  ) {
    return review("selected_status_requires_display_mode", {
      candidate: findSelectedCandidate(candidates, output.selected_sentence_id),
      output,
    });
  }

  const candidate = findSelectedCandidate(candidates, output.selected_sentence_id);

  if (!candidate) {
    return review("invalid_selected_sentence_id", { candidate: null, output });
  }

  const unusableReason = getUnusableCandidateReason(candidate.text);

  if (unusableReason) {
    return review(unusableReason, { candidate, output });
  }

  if (output.core_sentence !== candidate.text) {
    return review("core_sentence_must_equal_selected_candidate", {
      candidate,
      output,
    });
  }

  if (!output.display_sentence) {
    return review("missing_display_sentence", { candidate, output });
  }

  if (output.subject_clarity === "missing") {
    return review("missing_subject_clarity", { candidate, output });
  }

  if (output.stance_clarity === "missing") {
    return review("missing_stance_clarity", { candidate, output });
  }

  if (
    output.sentence_role &&
    NON_DISPLAYABLE_SENTENCE_ROLES.has(output.sentence_role)
  ) {
    return review("non_displayable_role_needs_review", { candidate, output });
  }

  if (
    !hasStanceAction(candidate.text) &&
    output.stance_clarity !== "clear" &&
    !output.stance_action
  ) {
    return review("weak_stance_signal", { candidate, output });
  }

  if (output.selected_mode === "sentence_only") {
    if (output.display_sentence !== candidate.text) {
      return review("sentence_only_display_must_equal_candidate", {
        candidate,
        output,
      });
    }

    return selected(candidate, candidate.text);
  }

  if (!output.topic_label) {
    return review("missing_topic_label", { candidate, output });
  }

  if (!isGroundedLabelCandidate(output.topic_label, output.display_sentence)) {
    return review("display_sentence_must_start_with_topic_label", {
      candidate,
      output,
    });
  }

  if (!includesNormalized(output.display_sentence, candidate.text)) {
    return review("display_sentence_must_include_candidate", {
      candidate,
      output,
    });
  }

  return selected(candidate, output.display_sentence);
}

function selected(
  candidate: StatementSentenceSelectionCandidate,
  displaySentence: string,
): ValidationResult {
  return {
    candidate,
    coreSentence: candidate.text,
    displaySentence,
    errorMessage: null,
    status: "selected",
  };
}

function review(
  errorMessage: string,
  {
    candidate,
    output,
  }: {
    candidate: StatementSentenceSelectionCandidate | null;
    output: StatementDisplayComparatorOutput;
  },
): ValidationResult {
  return {
    candidate,
    coreSentence: candidate?.text ?? output.core_sentence,
    displaySentence: output.display_sentence,
    errorMessage,
    status: "review_needed",
  };
}

function findSelectedCandidate(
  candidates: StatementSentenceSelectionCandidate[],
  selectedSentenceId: string | null,
) {
  if (!selectedSentenceId) {
    return null;
  }

  return (
    candidates.find((candidate) => candidate.id === selectedSentenceId) ?? null
  );
}

function isGroundedLabelCandidate(label: string, displaySentence: string) {
  const normalizedLabel = normalizeComparableText(label);
  const normalizedDisplay = normalizeComparableText(displaySentence);

  return (
    normalizedLabel.length >= 2 &&
    normalizedLabel.length <= 40 &&
    normalizedDisplay.startsWith(normalizedLabel)
  );
}

function includesNormalized(container: string, value: string) {
  return normalizeComparableText(container).includes(normalizeComparableText(value));
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
