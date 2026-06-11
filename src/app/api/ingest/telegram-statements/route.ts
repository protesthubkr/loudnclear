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
import { runTelegramStatementFeedScan } from "@/lib/telegram-statements/run";
import type { TelegramStatementRunOptions } from "@/lib/telegram-statements/types";

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
    const result = await runTelegramStatementFeedScan(
      parseRunOptions(new URLSearchParams()),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TelegramStatementIngestRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Telegram statement ingest failed"
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
    const result = await runTelegramStatementFeedScan(
      parseRunOptions(await readManualRunSearchParams(request)),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof TelegramStatementIngestRequestError ||
      error instanceof ManualRunRequestError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Telegram statement ingest failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

function parseRunOptions(searchParams: URLSearchParams): TelegramStatementRunOptions {
  const windowHours = parseWindowHours(searchParams.get("windowHours"));

  return {
    backfill:
      parseOptionalBoolean(searchParams.get("backfill")) ??
      Boolean(windowHours),
    channelUsername:
      normalizeChannelUsername(searchParams.get("channel")) ?? undefined,
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    maxPagesPerChannel: parseMaxPages(searchParams.get("maxPages")),
    windowHours,
  };
}

function normalizeChannelUsername(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@/, "").toLowerCase();

  if (!/^[a-z0-9_]{4,64}$/.test(normalized)) {
    throw new TelegramStatementIngestRequestError("Invalid channel.");
  }

  return normalized;
}

function parseMaxPages(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
    throw new TelegramStatementIngestRequestError("Invalid maxPages.");
  }

  return parsed;
}

function parseWindowHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_WINDOW_HOURS) {
    throw new TelegramStatementIngestRequestError("Invalid windowHours.");
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

  throw new TelegramStatementIngestRequestError("Invalid boolean option.");
}

class TelegramStatementIngestRequestError extends Error {}
