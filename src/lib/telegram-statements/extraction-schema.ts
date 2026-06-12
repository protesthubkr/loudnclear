export const TELEGRAM_STATEMENT_EXTRACTION_PROMPT_VERSION =
  "telegram_statement_sentence_v17";

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
] as const;

export const TELEGRAM_STATEMENT_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "is_target_document",
    "selected_candidate_id",
    "document_type",
    "core_sentence",
    "sentence_role",
    "target_subject",
    "stance_action",
    "displayable",
    "confidence",
    "reason",
  ],
  properties: {
    is_target_document: {
      type: "boolean",
    },
    selected_candidate_id: {
      type: ["string", "null"],
    },
    document_type: {
      type: "string",
      enum: [
        "statement",
        "commentary",
        "position",
        "press_release",
        "press_conference",
        "condemnation",
        "welcome",
      ],
    },
    core_sentence: {
      type: "string",
    },
    sentence_role: {
      type: "string",
      enum: STATEMENT_SENTENCE_ROLES,
    },
    target_subject: {
      type: ["string", "null"],
    },
    stance_action: {
      type: ["string", "null"],
    },
    displayable: {
      type: "boolean",
    },
    confidence: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    reason: {
      type: "string",
    },
  },
} as const;

export function buildTelegramStatementExtractionSchema(candidateIds: string[]) {
  return {
    ...TELEGRAM_STATEMENT_EXTRACTION_SCHEMA,
    properties: {
      ...TELEGRAM_STATEMENT_EXTRACTION_SCHEMA.properties,
      selected_candidate_id: {
        type: ["string", "null"],
        enum: [...candidateIds, null],
      },
    },
  };
}
