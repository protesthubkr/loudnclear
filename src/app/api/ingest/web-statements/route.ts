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
  isWebStatementSourceKey,
  runWebStatementIngest,
} from "@/lib/web-statements/run";
import type {
  WebStatementRunOptions,
  WebStatementSourceKey,
} from "@/lib/web-statements/types";

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
    const result = await runWebStatementIngest(
      parseRunOptions(new URLSearchParams()),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WebStatementRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Web statement ingest failed"
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
    const result = await runWebStatementIngest(
      parseRunOptions(await readManualRunSearchParams(request)),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof WebStatementRequestError ||
      error instanceof ManualRunRequestError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Web statement ingest failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

function parseRunOptions(searchParams: URLSearchParams): WebStatementRunOptions {
  return {
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    limit: parseLimit(searchParams.get("limit")),
    source: parseSource(searchParams.get("source")) ?? undefined,
    windowHours: parseWindowHours(searchParams.get("windowHours")),
  };
}

function parseSource(value: string | null): WebStatementSourceKey | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (isWebStatementSourceKey(normalized)) {
    return normalized;
  }

  throw new WebStatementRequestError("Invalid source.");
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
    throw new WebStatementRequestError("Invalid limit.");
  }

  return parsed;
}

function parseWindowHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_WINDOW_HOURS) {
    throw new WebStatementRequestError("Invalid windowHours.");
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

  throw new WebStatementRequestError("Invalid boolean option.");
}

class WebStatementRequestError extends Error {}
