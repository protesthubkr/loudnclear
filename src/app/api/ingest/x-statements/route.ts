import { NextRequest, NextResponse } from "next/server";
import { isBearerSecretAuthorized } from "@/lib/bearer-auth";
import {
  runXStatementFeedScan,
  XApiError,
  XStatementConfigError,
  type XStatementRunOptions,
} from "@/lib/x-statements/run";

const MAX_BACKFILL_DAYS = 90;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runXStatementFeedScan(parseRunOptions(request));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof XStatementIngestRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof XStatementConfigError) {
      return NextResponse.json(
        {
          error: "Missing X statement ingest configuration",
          missingKeys: error.missingKeys,
        },
        { status: 400 },
      );
    }

    if (error instanceof XApiError) {
      return NextResponse.json(
        {
          attempts: error.attempts,
          error: "X API request failed",
          status: error.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "X statement ingest failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}

function isAuthorized(request: NextRequest) {
  return isBearerSecretAuthorized(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
}

function parseRunOptions(request: NextRequest): XStatementRunOptions {
  const searchParams = request.nextUrl.searchParams;

  return {
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    maxPagesPerSource: parseMaxPages(searchParams.get("maxPages")),
    source: normalizeSource(searchParams.get("source")),
    startTime: parseStartTime(searchParams),
  };
}

function normalizeSource(value: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().replace(/^@/, "").toLowerCase();

  if (!/^[a-z0-9_]{2,64}$/.test(normalized)) {
    throw new XStatementIngestRequestError("Invalid source.");
  }

  return normalized;
}

function parseStartTime(searchParams: URLSearchParams) {
  const startTime = searchParams.get("startTime");

  if (startTime) {
    const timestamp = Date.parse(startTime);

    if (!Number.isFinite(timestamp)) {
      throw new XStatementIngestRequestError("Invalid startTime.");
    }

    return assertBackfillRange(new Date(timestamp).toISOString());
  }

  const startDate = searchParams.get("startDate");

  if (!startDate) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new XStatementIngestRequestError("Invalid startDate.");
  }

  return assertBackfillRange(new Date(`${startDate}T00:00:00+09:00`).toISOString());
}

function assertBackfillRange(startTime: string) {
  const earliest = Date.now() - MAX_BACKFILL_DAYS * 24 * 60 * 60 * 1000;

  if (Date.parse(startTime) < earliest) {
    throw new XStatementIngestRequestError("startTime is too old.");
  }

  return startTime;
}

function parseMaxPages(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 25) {
    throw new XStatementIngestRequestError("Invalid maxPages.");
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

  throw new XStatementIngestRequestError("Invalid boolean option.");
}

function methodNotAllowed(allowedMethods: string[]) {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    {
      headers: {
        Allow: allowedMethods.join(", "),
      },
      status: 405,
    },
  );
}

class XStatementIngestRequestError extends Error {}
