const DEFAULT_TOPIC_WINDOW_HOURS = 48;
const DEFAULT_TELEGRAM_TOPIC_THRESHOLD = 0.55;
const DEFAULT_PARTY_TOPIC_THRESHOLD = 0.72;
const DEFAULT_TOPIC_EMBEDDING_BATCH_SIZE = 32;
const DEFAULT_TOPIC_EMBEDDING_DIMENSIONS = 512;
const DEFAULT_TOPIC_EMBEDDING_INPUT_CHARS = 4000;
const DEFAULT_TOPIC_RUN_LIMIT = 100;

export function getStatementTopicWindowHours() {
  return readIntegerEnv("STATEMENT_TOPIC_WINDOW_HOURS", {
    defaultValue: DEFAULT_TOPIC_WINDOW_HOURS,
    max: 744,
    min: 1,
  });
}

export function getStatementTopicTelegramThreshold() {
  return readNumberEnv("STATEMENT_TOPIC_TELEGRAM_THRESHOLD", {
    defaultValue: DEFAULT_TELEGRAM_TOPIC_THRESHOLD,
    max: 0.99,
    min: 0.3,
  });
}

export function getStatementTopicPartyThreshold() {
  return readNumberEnv("STATEMENT_TOPIC_PARTY_THRESHOLD", {
    defaultValue: DEFAULT_PARTY_TOPIC_THRESHOLD,
    max: 0.99,
    min: 0.3,
  });
}

export function getStatementTopicEmbeddingModel() {
  return readRequiredStringEnv("OPENAI_STATEMENT_TOPIC_EMBEDDING_MODEL");
}

export function getStatementTopicEmbeddingDimensions() {
  return readIntegerEnv("OPENAI_STATEMENT_TOPIC_EMBEDDING_DIMENSIONS", {
    defaultValue: DEFAULT_TOPIC_EMBEDDING_DIMENSIONS,
    max: 3072,
    min: 64,
  });
}

export function getStatementTopicEmbeddingInputChars() {
  return readIntegerEnv("STATEMENT_TOPIC_EMBEDDING_INPUT_CHARS", {
    defaultValue: DEFAULT_TOPIC_EMBEDDING_INPUT_CHARS,
    max: 12000,
    min: 500,
  });
}

export function getStatementTopicEmbeddingBatchSize() {
  return readIntegerEnv("STATEMENT_TOPIC_EMBEDDING_BATCH_SIZE", {
    defaultValue: DEFAULT_TOPIC_EMBEDDING_BATCH_SIZE,
    max: 128,
    min: 1,
  });
}

export function getStatementTopicRunLimit() {
  return readIntegerEnv("STATEMENT_TOPIC_RUN_LIMIT", {
    defaultValue: DEFAULT_TOPIC_RUN_LIMIT,
    max: 500,
    min: 1,
  });
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

function readNumberEnv(
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

  const parsed = Number.parseFloat(value);

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
