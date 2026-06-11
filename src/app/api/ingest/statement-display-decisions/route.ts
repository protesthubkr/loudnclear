import { NextRequest, NextResponse } from "next/server";
import {
  hasUrlRunOptions,
  isCronRunAuthorized,
  isManualRunAuthorized,
  ManualRunRequestError,
  readManualRunSearchParams,
  rejectUrlRunOptions,
  unauthorized,
} from "@/lib/ingest-route";
import {
  runStatementDisplayDecisionPipeline,
  type StatementDisplayDecisionRunOptions,
} from "@/lib/statement-display-decisions/run";
import type { StatementSentenceSelectionSourceType } from "@/lib/statement-sentence-selections/types";

const MAX_WINDOW_HOURS = 744;
const MAX_DISPLAY_DECISION_LIMIT = 500;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isCronRunAuthorized(request)) {
    return unauthorized();
  }

  if (hasUrlRunOptions(request)) {
    return rejectUrlRunOptions();
  }

  try {
    const result = await runStatementDisplayDecisionPipeline(
      parseRunOptions(new URLSearchParams()),
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatementDisplayDecisionRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement display decision failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isManualRunAuthorized(request)) {
    return unauthorized();
  }

  try {
    const result = await runStatementDisplayDecisionPipeline(
      parseRunOptions(await readManualRunSearchParams(request)),
    );

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof StatementDisplayDecisionRequestError ||
      error instanceof ManualRunRequestError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement display decision failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

function parseRunOptions(
  searchParams: URLSearchParams,
): StatementDisplayDecisionRunOptions {
  return {
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    force: parseOptionalBoolean(searchParams.get("force")) ?? false,
    limit: parseLimit(searchParams.get("limit")),
    retryFailed: parseOptionalBoolean(searchParams.get("retryFailed")) ?? false,
    sourceType: parseSourceType(searchParams.get("sourceType")) ?? undefined,
    summaryId: parseSummaryId(searchParams.get("summaryId")) ?? undefined,
    windowHours: parseWindowHours(searchParams.get("windowHours")),
  };
}

function parseSourceType(
  value: string | null,
): StatementSentenceSelectionSourceType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized === "telegram" ||
    normalized === "party" ||
    normalized === "web" ||
    normalized === "x"
  ) {
    return normalized;
  }

  throw new StatementDisplayDecisionRequestError("Invalid sourceType.");
}

function parseSummaryId(value: string | null) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    )
  ) {
    throw new StatementDisplayDecisionRequestError("Invalid summaryId.");
  }

  return normalized;
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1 ||
    parsed > MAX_DISPLAY_DECISION_LIMIT
  ) {
    throw new StatementDisplayDecisionRequestError("Invalid limit.");
  }

  return parsed;
}

function parseWindowHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_WINDOW_HOURS) {
    throw new StatementDisplayDecisionRequestError("Invalid windowHours.");
  }

  return parsed;
}

function parseOptionalBoolean(value: string | null) {
  if (value === null) {
    return undefined;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throw new StatementDisplayDecisionRequestError("Invalid boolean option.");
}

class StatementDisplayDecisionRequestError extends Error {}
