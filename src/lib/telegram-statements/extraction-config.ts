const DEFAULT_STATEMENT_EXTRACTION_MAX_OUTPUT_TOKENS = 1200;
const DEFAULT_STATEMENT_COMPACTION_MAX_OUTPUT_TOKENS = 400;
const DEFAULT_STATEMENT_EXTRACTION_INPUT_CHARS = 3000;
const DEFAULT_STATEMENT_COMPACTION_INPUT_CHARS = 2500;
const DEFAULT_STATEMENT_EXTRACTION_LIMIT = 10;
const DEFAULT_STATEMENT_EXTRACTION_MAX_ATTEMPTS = 3;
const DEFAULT_STATEMENT_COMPACTION_MIN_CHARS = 60;

export function getStatementExtractionModel() {
  return readRequiredStringEnv("OPENAI_STATEMENT_EXTRACTION_MODEL");
}

export function getStatementExtractionMaxOutputTokens() {
  const value = process.env.OPENAI_STATEMENT_EXTRACTION_MAX_OUTPUT_TOKENS;

  if (!value) {
    return DEFAULT_STATEMENT_EXTRACTION_MAX_OUTPUT_TOKENS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_EXTRACTION_MAX_OUTPUT_TOKENS;
  }

  return Math.min(Math.max(parsed, 400), 4000);
}

export function getStatementCompactionModel() {
  return (
    process.env.OPENAI_STATEMENT_COMPACTION_MODEL?.trim() ||
    getStatementExtractionModel()
  );
}

export function getStatementCompactionMaxOutputTokens() {
  const value = process.env.OPENAI_STATEMENT_COMPACTION_MAX_OUTPUT_TOKENS;

  if (!value) {
    return DEFAULT_STATEMENT_COMPACTION_MAX_OUTPUT_TOKENS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_COMPACTION_MAX_OUTPUT_TOKENS;
  }

  return Math.min(Math.max(parsed, 150), 1000);
}

export function getStatementCompactionInputChars() {
  const value = process.env.OPENAI_STATEMENT_COMPACTION_INPUT_CHARS;

  if (!value) {
    return DEFAULT_STATEMENT_COMPACTION_INPUT_CHARS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_COMPACTION_INPUT_CHARS;
  }

  return Math.min(Math.max(parsed, 1000), 8000);
}

export function getStatementCompactionMinChars() {
  const value = process.env.OPENAI_STATEMENT_COMPACTION_MIN_CHARS;

  if (!value) {
    return DEFAULT_STATEMENT_COMPACTION_MIN_CHARS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_COMPACTION_MIN_CHARS;
  }

  return Math.min(Math.max(parsed, 60), 220);
}

export function getStatementExtractionInputChars() {
  const value = process.env.OPENAI_STATEMENT_EXTRACTION_INPUT_CHARS;

  if (!value) {
    return DEFAULT_STATEMENT_EXTRACTION_INPUT_CHARS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_EXTRACTION_INPUT_CHARS;
  }

  return Math.min(Math.max(parsed, 1000), 20000);
}

export function getStatementPromptCacheKey() {
  const value = process.env.OPENAI_STATEMENT_PROMPT_CACHE_KEY?.trim();

  if (value === "off" || value === "false" || value === "0") {
    return null;
  }

  return value || null;
}

export function getStatementPromptCacheRetention() {
  const value = process.env.OPENAI_STATEMENT_PROMPT_CACHE_RETENTION?.trim();

  if (value === "in_memory" || value === "24h") {
    return value;
  }

  return undefined;
}

export function getStatementExtractionLimit() {
  const value = process.env.TELEGRAM_STATEMENT_EXTRACTION_LIMIT;

  if (!value) {
    return DEFAULT_STATEMENT_EXTRACTION_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_EXTRACTION_LIMIT;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

export function getStatementExtractionMaxAttempts() {
  const value = process.env.TELEGRAM_STATEMENT_EXTRACTION_MAX_ATTEMPTS;

  if (!value) {
    return DEFAULT_STATEMENT_EXTRACTION_MAX_ATTEMPTS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_STATEMENT_EXTRACTION_MAX_ATTEMPTS;
  }

  return Math.min(Math.max(parsed, 1), 10);
}

function readRequiredStringEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
}
