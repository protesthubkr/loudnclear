import {
  parseResponsesJsonObject,
  readResponsesOutputText,
} from "@/lib/llm/responses-output";
import type { StatementExtractionModelOutput } from "./extractor-types";
import { normalizeConfidence } from "./sentence-match";
import { STATEMENT_SENTENCE_ROLES } from "./extraction-schema";

export function parseStatementExtractionOutput(payload: unknown) {
  const text = readResponsesOutputText(payload);

  if (!text) {
    throw new Error("Statement extraction returned no output text.");
  }

  return sanitizeStatementExtractionOutput(
    parseResponsesJsonObject<StatementExtractionModelOutput>(text),
  );
}

function sanitizeStatementExtractionOutput(output: StatementExtractionModelOutput) {
  const sentenceRole = STATEMENT_SENTENCE_ROLES.includes(output.sentence_role)
    ? output.sentence_role
    : "context";

  return {
    confidence: normalizeConfidence(output.confidence),
    core_sentence:
      typeof output.core_sentence === "string" ? output.core_sentence.trim() : "",
    displayable: Boolean(output.displayable),
    document_type: output.document_type,
    is_target_document: Boolean(output.is_target_document),
    reason: typeof output.reason === "string" ? output.reason.trim() : "",
    selected_candidate_id:
      typeof output.selected_candidate_id === "string" &&
      output.selected_candidate_id.trim()
        ? output.selected_candidate_id.trim().toUpperCase()
        : null,
    sentence_role: sentenceRole,
    stance_action:
      typeof output.stance_action === "string" && output.stance_action.trim()
        ? output.stance_action.trim()
        : null,
    target_subject:
      typeof output.target_subject === "string" && output.target_subject.trim()
        ? output.target_subject.trim()
        : null,
  } satisfies StatementExtractionModelOutput;
}
