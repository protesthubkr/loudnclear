const DEFAULT_EXTRACTION_REASONING_EFFORT = "minimal";
const REASONING_EFFORTS = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

export function getReasoningRequestOptions(model: string) {
  if (!isReasoningModel(model)) {
    return {};
  }

  const configuredEffort = process.env.OPENAI_STATEMENT_REASONING_EFFORT
    ?.trim()
    .toLowerCase();
  const effort = configuredEffort || DEFAULT_EXTRACTION_REASONING_EFFORT;

  if (!REASONING_EFFORTS.has(effort)) {
    return {
      reasoning: {
        effort: DEFAULT_EXTRACTION_REASONING_EFFORT,
      },
    };
  }

  if (effort === "none" && !model.startsWith("gpt-5.1")) {
    return {
      reasoning: {
        effort: DEFAULT_EXTRACTION_REASONING_EFFORT,
      },
    };
  }

  return {
    reasoning: {
      effort,
    },
  };
}

function isReasoningModel(model: string) {
  return model.startsWith("gpt-5") || /^o\d/.test(model);
}
