import { NextRequest, NextResponse } from "next/server";
import { isBearerSecretAuthorized } from "@/lib/bearer-auth";
import {
  runStatementSentenceSelectionComparison,
  type StatementSentenceSelectionRunOptions,
} from "@/lib/statement-sentence-selections/run";
import type { StatementSentenceSelectionSourceType } from "@/lib/statement-sentence-selections/types";

const MAX_WINDOW_HOURS = 744;
const MAX_SELECTION_LIMIT = 500;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runStatementSentenceSelectionComparison(
      parseRunOptions(request),
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatementSentenceSelectionRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement sentence selection failed"
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

function parseRunOptions(
  request: NextRequest,
): StatementSentenceSelectionRunOptions {
  const searchParams = request.nextUrl.searchParams;

  return {
    dryRun: parseOptionalBoolean(searchParams.get("dryRun")) ?? false,
    force: parseOptionalBoolean(searchParams.get("force")) ?? false,
    limit: parseLimit(searchParams.get("limit")),
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

  if (normalized === "telegram" || normalized === "party" || normalized === "x") {
    return normalized;
  }

  throw new StatementSentenceSelectionRequestError("Invalid sourceType.");
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
    throw new StatementSentenceSelectionRequestError("Invalid summaryId.");
  }

  return normalized;
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_SELECTION_LIMIT) {
    throw new StatementSentenceSelectionRequestError("Invalid limit.");
  }

  return parsed;
}

function parseWindowHours(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_WINDOW_HOURS) {
    throw new StatementSentenceSelectionRequestError("Invalid windowHours.");
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

  throw new StatementSentenceSelectionRequestError("Invalid boolean option.");
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

class StatementSentenceSelectionRequestError extends Error {}
