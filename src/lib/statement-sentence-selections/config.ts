const DEFAULT_SELECTION_MODEL = "gpt-5-mini";
const DEFAULT_SELECTION_LIMIT = 10;
const DEFAULT_SELECTION_WINDOW_HOURS = 240;
const DEFAULT_MAX_CANDIDATES = 140;
const DEFAULT_MAX_INPUT_CHARS = 30000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1800;

export const STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION =
  "statement_sentence_selector_v4";
export const STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION =
  "statement_sentence_verifier_v4";

export function getStatementSentenceSelectorModel() {
  return (
    process.env.OPENAI_STATEMENT_SELECTOR_MODEL?.trim() ||
    process.env.OPENAI_STATEMENT_EXTRACTION_MODEL?.trim() ||
    DEFAULT_SELECTION_MODEL
  );
}

export function getStatementSentenceVerifierModel() {
  return (
    process.env.OPENAI_STATEMENT_VERIFIER_MODEL?.trim() ||
    process.env.OPENAI_STATEMENT_SELECTOR_MODEL?.trim() ||
    process.env.OPENAI_STATEMENT_EXTRACTION_MODEL?.trim() ||
    DEFAULT_SELECTION_MODEL
  );
}

export function getStatementSentenceSelectionLimit() {
  const value = process.env.STATEMENT_SENTENCE_SELECTION_LIMIT;

  if (!value) {
    return DEFAULT_SELECTION_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SELECTION_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

export function getStatementSentenceSelectionWindowHours() {
  const value = process.env.STATEMENT_SENTENCE_SELECTION_WINDOW_HOURS;

  if (!value) {
    return DEFAULT_SELECTION_WINDOW_HOURS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SELECTION_WINDOW_HOURS;
  }

  return Math.min(Math.max(parsed, 1), 744);
}

export function getStatementSentenceSelectionMaxCandidates() {
  const value = process.env.STATEMENT_SENTENCE_SELECTION_MAX_CANDIDATES;

  if (!value) {
    return DEFAULT_MAX_CANDIDATES;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_CANDIDATES;
  }

  return Math.min(Math.max(parsed, 30), 300);
}

export function getStatementSentenceSelectionMaxInputChars() {
  const value = process.env.STATEMENT_SENTENCE_SELECTION_MAX_INPUT_CHARS;

  if (!value) {
    return DEFAULT_MAX_INPUT_CHARS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_INPUT_CHARS;
  }

  return Math.min(Math.max(parsed, 5000), 80000);
}

export function getStatementSentenceSelectionMaxOutputTokens() {
  const value = process.env.STATEMENT_SENTENCE_SELECTION_MAX_OUTPUT_TOKENS;

  if (!value) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }

  return Math.min(Math.max(parsed, 800), 6000);
}
