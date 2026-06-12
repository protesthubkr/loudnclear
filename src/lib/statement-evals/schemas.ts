export const STATEMENT_EVAL_PLANNER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "final_status",
    "summary_mode",
    "spans",
    "role_tags",
    "issue_clarity",
    "stance_clarity",
    "reason",
  ],
  properties: {
    final_status: {
      type: "string",
      enum: ["selected", "review_needed", "rejected", "failed"],
    },
    summary_mode: {
      type: "string",
      enum: ["single_span", "issue_plus_stance", "two_sentence"],
    },
    spans: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "candidate_id", "text"],
        properties: {
          role: {
            type: "string",
            enum: ["issue", "stance", "combined"],
          },
          candidate_id: {
            type: "string",
          },
          text: {
            type: "string",
          },
        },
      },
    },
    role_tags: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["candidate_id", "role"],
        properties: {
          candidate_id: {
            type: "string",
          },
          role: {
            type: "string",
            enum: ["issue", "stance", "combined", "context", "notice", "bad"],
          },
        },
      },
    },
    issue_clarity: {
      type: "string",
      enum: ["clear", "implied", "missing"],
    },
    stance_clarity: {
      type: "string",
      enum: ["clear", "weak", "missing"],
    },
    reason: {
      type: "string",
    },
  },
} as const;
