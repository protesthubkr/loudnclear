import type { StatementSentenceRole } from "./types";

export const STATEMENT_SENTENCE_ROLES = [
  "demand",
  "condemnation",
  "criticism",
  "welcome",
  "concern",
  "pledge",
  "context",
  "notice",
  "tribute",
  "resource_intro",
] as const satisfies readonly StatementSentenceRole[];

export const STATEMENT_SENTENCE_SELECTOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_target_document",
    "selected_sentence_id",
    "sentence_role",
    "target_subject",
    "stance_action",
    "displayable",
    "confidence",
    "reason",
  ],
  properties: {
    is_target_document: { type: "boolean" },
    selected_sentence_id: { type: ["string", "null"] },
    sentence_role: { type: "string", enum: STATEMENT_SENTENCE_ROLES },
    target_subject: { type: ["string", "null"] },
    stance_action: { type: ["string", "null"] },
    displayable: { type: "boolean" },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    reason: { type: "string" },
  },
} as const;

export const STATEMENT_SENTENCE_VERIFIER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "displayable",
    "sentence_role",
    "target_subject",
    "stance_action",
    "confidence",
    "reason",
  ],
  properties: {
    displayable: { type: "boolean" },
    sentence_role: { type: "string", enum: STATEMENT_SENTENCE_ROLES },
    target_subject: { type: ["string", "null"] },
    stance_action: { type: ["string", "null"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    reason: { type: "string" },
  },
} as const;
