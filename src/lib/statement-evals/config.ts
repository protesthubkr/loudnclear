import type { StatementEvalVariantKey } from "./types";

const DEFAULT_EVAL_LIMIT = 20;
const DEFAULT_EVAL_MAX_OUTPUT_TOKENS = 3000;
const DEFAULT_EVAL_REASONING_EFFORT = "low";
const DEFAULT_EVAL_WINDOW_HOURS = 168;

export function getStatementEvalLimit() {
  return readIntegerEnv("STATEMENT_EVAL_LIMIT", {
    defaultValue: DEFAULT_EVAL_LIMIT,
    max: 500,
    min: 1,
  });
}

export function getStatementEvalWindowHours() {
  return readIntegerEnv("STATEMENT_EVAL_WINDOW_HOURS", {
    defaultValue: DEFAULT_EVAL_WINDOW_HOURS,
    max: 744,
    min: 1,
  });
}

export function getStatementEvalModel() {
  return (
    process.env.OPENAI_STATEMENT_EVAL_MODEL?.trim() ||
    process.env.OPENAI_STATEMENT_DISPLAY_DECISION_MODEL?.trim() ||
    readRequiredStringEnv("OPENAI_STATEMENT_EXTRACTION_MODEL")
  );
}

export function getStatementEvalReasoningEffort() {
  return (
    process.env.OPENAI_STATEMENT_EVAL_REASONING_EFFORT?.trim() ||
    DEFAULT_EVAL_REASONING_EFFORT
  );
}

export function getStatementEvalDefaultReasoningEffort() {
  return DEFAULT_EVAL_REASONING_EFFORT;
}

export function getStatementEvalMaxOutputTokens() {
  return readIntegerEnv("OPENAI_STATEMENT_EVAL_MAX_OUTPUT_TOKENS", {
    defaultValue: DEFAULT_EVAL_MAX_OUTPUT_TOKENS,
    max: 6000,
    min: 800,
  });
}

export function parseStatementEvalVariantKeys(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as StatementEvalVariantKey[];
}

function readIntegerEnv(
  key: string,
  {
    defaultValue,
    max,
    min,
  }: {
    defaultValue: number;
    max: number;
    min: number;
  },
) {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, min), max);
}

function readRequiredStringEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
}
