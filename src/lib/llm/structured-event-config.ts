const DEFAULT_EXTRACTION_REASONING_EFFORT = "minimal";
const REASONING_EFFORTS = new Set([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

type ReasoningRequestOptions = {
  defaultEffort?: string;
  effortEnvKey?: string;
};

export function getReasoningRequestOptions(
  model: string,
  options: ReasoningRequestOptions = {},
) {
  if (!isReasoningModel(model)) {
    return {};
  }

  const defaultEffort =
    options.defaultEffort ?? DEFAULT_EXTRACTION_REASONING_EFFORT;
  const effortEnvKey =
    options.effortEnvKey ?? "OPENAI_STATEMENT_REASONING_EFFORT";
  const configuredEffort = process.env[effortEnvKey]
    ?.trim()
    .toLowerCase();
  const effort = configuredEffort || defaultEffort;

  if (!REASONING_EFFORTS.has(effort)) {
    return {
      reasoning: {
        effort: defaultEffort,
      },
    };
  }

  if (effort === "none" && !model.startsWith("gpt-5.1")) {
    return {
      reasoning: {
        effort: defaultEffort,
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
