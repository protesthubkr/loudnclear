const DEFAULT_CONTEXT_CHARS = 20000;
const DEFAULT_DISPLAY_DECISION_LIMIT = 20;
const DEFAULT_MAX_OUTPUT_TOKENS = 2200;
const DEFAULT_REASONING_EFFORT = "medium";
const DEFAULT_WINDOW_HOURS = 240;

export const STATEMENT_DISPLAY_DECISION_PROMPT_VERSION =
  "statement_display_decision_v2_ac_judge";
export const STATEMENT_DISPLAY_DECISION_REASONING_ENV_KEY =
  "OPENAI_STATEMENT_DISPLAY_DECISION_REASONING_EFFORT";

export function getStatementDisplayDecisionModel() {
  return (
    process.env.OPENAI_STATEMENT_DISPLAY_DECISION_MODEL?.trim() ||
    readRequiredStringEnv("OPENAI_STATEMENT_EXTRACTION_MODEL")
  );
}

export function getStatementDisplayDecisionLimit() {
  const value = process.env.STATEMENT_DISPLAY_DECISION_LIMIT;

  if (!value) {
    return DEFAULT_DISPLAY_DECISION_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DISPLAY_DECISION_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), 500);
}

export function getStatementDisplayDecisionWindowHours() {
  const value = process.env.STATEMENT_DISPLAY_DECISION_WINDOW_HOURS;

  if (!value) {
    return DEFAULT_WINDOW_HOURS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_WINDOW_HOURS;
  }

  return Math.min(Math.max(parsed, 1), 744);
}

export function getStatementDisplayDecisionContextChars() {
  const value = process.env.STATEMENT_DISPLAY_DECISION_CONTEXT_CHARS;

  if (!value) {
    return DEFAULT_CONTEXT_CHARS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONTEXT_CHARS;
  }

  return Math.min(Math.max(parsed, 4000), 60000);
}

export function getStatementDisplayDecisionMaxOutputTokens() {
  const value = process.env.OPENAI_STATEMENT_DISPLAY_DECISION_MAX_OUTPUT_TOKENS;

  if (!value) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }

  return Math.min(Math.max(parsed, 800), 6000);
}

export function getStatementDisplayDecisionDefaultReasoningEffort() {
  return DEFAULT_REASONING_EFFORT;
}

function readRequiredStringEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
}
