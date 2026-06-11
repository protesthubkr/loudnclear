import "server-only";

const DEFAULT_POSTS_PER_SOURCE = 10;
const DEFAULT_TIMELINE_PAGES_PER_SOURCE = 1;
const DEFAULT_BACKFILL_TIMELINE_PAGES_PER_SOURCE = 5;

export class XStatementConfigError extends Error {
  constructor(readonly missingKeys: string[]) {
    super(`Missing X statement configuration: ${missingKeys.join(", ")}`);
  }
}

export function getXStatementConfig() {
  const bearerToken = process.env.X_BEARER_TOKEN;

  if (!bearerToken) {
    throw new XStatementConfigError(["X_BEARER_TOKEN"]);
  }

  return {
    bearerToken,
    backfillTimelinePagesPerSource: parseBoundedInteger(
      process.env.X_STATEMENT_BACKFILL_TIMELINE_PAGES_PER_SOURCE,
      DEFAULT_BACKFILL_TIMELINE_PAGES_PER_SOURCE,
      1,
      25,
    ),
    postsPerSource: parseBoundedInteger(
      process.env.X_STATEMENT_POSTS_PER_SOURCE,
      DEFAULT_POSTS_PER_SOURCE,
      5,
      100,
    ),
    timelinePagesPerSource: parseBoundedInteger(
      process.env.X_STATEMENT_TIMELINE_PAGES_PER_SOURCE,
      DEFAULT_TIMELINE_PAGES_PER_SOURCE,
      1,
      25,
    ),
  };
}

function parseBoundedInteger(
  rawValue: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(rawValue ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, min), max);
}
