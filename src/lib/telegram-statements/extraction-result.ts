import { TELEGRAM_STATEMENT_EXTRACTION_PROMPT_VERSION } from "./extraction-schema";
import { buildStatementExtractionCandidates } from "./extraction-candidates";
import {
  TelegramStatementInconsistentOutputError,
  TelegramStatementSentenceNotFoundError,
} from "./extractor-errors";
import type {
  ExtractTelegramStatementSentenceInput,
  StatementSentenceRole,
  StatementExtractionModelOutput,
  TelegramStatementSentenceExtractionResult,
} from "./extractor-types";
import { findSentenceInSource, normalizeConfidence } from "./sentence-match";

const DISPLAYABLE_SENTENCE_ROLES = new Set<StatementSentenceRole>([
  "demand",
  "condemnation",
  "criticism",
  "welcome",
  "concern",
  "pledge",
]);

export function buildTelegramStatementExtractionResult(
  input: ExtractTelegramStatementSentenceInput,
  output: StatementExtractionModelOutput,
  model: string,
): TelegramStatementSentenceExtractionResult {
  const candidates = buildStatementExtractionCandidates(input.textSnapshot);
  const selectedCandidate = output.selected_candidate_id
    ? candidates.find((candidate) => candidate.id === output.selected_candidate_id)
    : null;
  const coreSentence = selectedCandidate?.text ?? output.core_sentence.trim();

  if (
    output.is_target_document &&
    output.displayable &&
    DISPLAYABLE_SENTENCE_ROLES.has(output.sentence_role) &&
    !selectedCandidate
  ) {
    throw new TelegramStatementInconsistentOutputError(
      `missing_or_invalid_selected_candidate_id:${output.selected_candidate_id ?? "null"}`,
    );
  }

  if (
    !output.is_target_document ||
    !output.displayable ||
    !DISPLAYABLE_SENTENCE_ROLES.has(output.sentence_role) ||
    !selectedCandidate ||
    !coreSentence
  ) {
    return {
      confidence: normalizeConfidence(output.confidence),
      coreSentence: "",
      coreSentenceEnd: null,
      coreSentenceStart: null,
      displayable: output.displayable,
      documentType: output.document_type,
      isTargetDocument: false,
      model,
      promptVersion: getStatementExtractionPromptVersion(input),
      reason: output.reason.trim(),
      sentenceRole: output.sentence_role,
      stanceAction: output.stance_action,
      targetSubject: output.target_subject,
    };
  }

  const match = findSentenceInSource(input.textSnapshot, coreSentence);

  if (!match) {
    throw new TelegramStatementSentenceNotFoundError(coreSentence);
  }

  return {
    confidence: normalizeConfidence(output.confidence),
    coreSentence: match.sentence,
    coreSentenceEnd: match.end,
    coreSentenceStart: match.start,
    displayable: output.displayable,
    documentType: output.document_type,
    isTargetDocument: true,
    model,
    promptVersion: getStatementExtractionPromptVersion(input),
    reason: [
      output.reason.trim(),
      `candidate:${selectedCandidate.id}`,
      `role:${output.sentence_role}`,
      output.target_subject ? `subject:${output.target_subject}` : "",
      output.stance_action ? `action:${output.stance_action}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    sentenceRole: output.sentence_role,
    stanceAction: output.stance_action,
    targetSubject: output.target_subject,
  };
}

function getStatementExtractionPromptVersion(
  input: ExtractTelegramStatementSentenceInput,
) {
  if (input.extractionGuidance === "people_power_strong_expression") {
    return `${TELEGRAM_STATEMENT_EXTRACTION_PROMPT_VERSION}+people_power_strong_v1`;
  }

  return TELEGRAM_STATEMENT_EXTRACTION_PROMPT_VERSION;
}
