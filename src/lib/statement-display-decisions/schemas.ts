import { STATEMENT_SENTENCE_ROLES } from "@/lib/statement-sentence-selections/schemas";

export const STATEMENT_DISPLAY_DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "final_status",
    "selected_mode",
    "selected_sentence_id",
    "core_sentence",
    "topic_label",
    "display_sentence",
    "target_subject",
    "stance_action",
    "sentence_role",
    "subject_clarity",
    "stance_clarity",
    "confidence",
    "reason",
  ],
  properties: {
    final_status: {
      type: "string",
      enum: ["selected", "review_needed", "rejected"],
    },
    selected_mode: {
      type: "string",
      enum: [
        "sentence_only",
        "label_plus_sentence",
        "review_needed",
        "rejected",
      ],
    },
    selected_sentence_id: { type: ["string", "null"] },
    core_sentence: { type: ["string", "null"] },
    topic_label: { type: ["string", "null"] },
    display_sentence: { type: ["string", "null"] },
    target_subject: { type: ["string", "null"] },
    stance_action: { type: ["string", "null"] },
    sentence_role: {
      type: ["string", "null"],
      enum: [...STATEMENT_SENTENCE_ROLES, null],
    },
    subject_clarity: {
      type: "string",
      enum: ["clear", "implied", "missing"],
    },
    stance_clarity: {
      type: "string",
      enum: ["clear", "weak", "missing"],
    },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    reason: { type: "string" },
  },
} as const;
