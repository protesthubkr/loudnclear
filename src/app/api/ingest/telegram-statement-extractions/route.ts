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
  runTelegramStatementExtractions,
  type TelegramStatementExtractionRunOptions,
} from "@/lib/telegram-statements/extraction-run";

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
    const result = await runTelegramStatementExtractions(
      parseRunOptions(new URLSearchParams()),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TelegramStatementExtractionRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Telegram statement extraction failed"
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
    const result = await runTelegramStatementExtractions(
      parseRunOptions(await readManualRunSearchParams(request)),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof TelegramStatementExtractionRequestError ||
      error instanceof ManualRunRequestError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Telegram statement extraction failed"
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
): TelegramStatementExtractionRunOptions {
  return {
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    limit: parseLimit(searchParams.get("limit")),
    summaryId: normalizeUuid(searchParams.get("summaryId")) ?? undefined,
    windowHours: parseWindowHours(searchParams.get("windowHours")),
  };
}

function normalizeUuid(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    )
  ) {
    throw new TelegramStatementExtractionRequestError("Invalid summaryId.");
  }

  return normalized;
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
    throw new TelegramStatementExtractionRequestError("Invalid limit.");
  }

  return parsed;
}

function parseWindowHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_WINDOW_HOURS) {
    throw new TelegramStatementExtractionRequestError("Invalid windowHours.");
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

  throw new TelegramStatementExtractionRequestError("Invalid boolean option.");
}

class TelegramStatementExtractionRequestError extends Error {}
