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
  getStatementTopicErrorMessage,
  runStatementTopicMatching,
  type StatementTopicRunOptions,
} from "@/lib/statement-topics/run";

const MAX_WINDOW_HOURS = 744;

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
    const result = await runStatementTopicMatching(
      parseRunOptions(new URLSearchParams()),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatementTopicRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement topic matching failed"
            : getStatementTopicErrorMessage(error),
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
    const result = await runStatementTopicMatching(
      parseRunOptions(await readManualRunSearchParams(request)),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof StatementTopicRequestError ||
      error instanceof ManualRunRequestError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement topic matching failed"
            : getStatementTopicErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

function parseRunOptions(searchParams: URLSearchParams): StatementTopicRunOptions {
  return {
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    limit: parseLimit(searchParams.get("limit")),
    windowHours: parseWindowHours(searchParams.get("windowHours")),
  };
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
    throw new StatementTopicRequestError("Invalid limit.");
  }

  return parsed;
}

function parseWindowHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_WINDOW_HOURS) {
    throw new StatementTopicRequestError("Invalid windowHours.");
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

  throw new StatementTopicRequestError("Invalid boolean option.");
}

class StatementTopicRequestError extends Error {}
