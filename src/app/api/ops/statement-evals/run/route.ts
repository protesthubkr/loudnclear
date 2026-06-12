import { NextRequest, NextResponse } from "next/server";
import { isManualRunAuthorized, unauthorized } from "@/lib/ingest-route";
import {
  runStatementEvalLab,
  type StatementEvalRunOptions,
} from "@/lib/statement-evals/run";
import type {
  StatementEvalSourceType,
  StatementEvalVariantKey,
} from "@/lib/statement-evals/types";
import { isStatementEvalVariantKey } from "@/lib/statement-evals/variants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isManualRunAuthorized(request)) {
    return unauthorized();
  }

  try {
    const result = await runStatementEvalLab(parseRunOptions(await readBody(request)));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StatementEvalRunRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement eval run failed"
            : error instanceof Error
              ? error.message
              : String(error),
      },
      { status: 500 },
    );
  }
}

async function readBody(request: NextRequest) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new StatementEvalRunRequestError("Invalid JSON body.");
  }
}

function parseRunOptions(body: unknown): StatementEvalRunOptions {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new StatementEvalRunRequestError("Invalid JSON body.");
  }

  const record = body as Record<string, unknown>;

  return {
    dryRun: parseOptionalBoolean(record.dryRun),
    limit: parseOptionalInteger(record.limit, 1, 500, "limit"),
    sourceType: parseOptionalSourceType(record.sourceType),
    summaryId: parseOptionalString(record.summaryId),
    variantKeys: parseOptionalVariantKeys(record.variantKeys),
    windowHours: parseOptionalInteger(record.windowHours, 1, 744, "windowHours"),
  };
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }

  throw new StatementEvalRunRequestError("Invalid boolean option.");
}

function parseOptionalInteger(
  value: unknown,
  min: number,
  max: number,
  name: string,
) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new StatementEvalRunRequestError(`Invalid ${name}.`);
  }

  return parsed;
}

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseOptionalSourceType(value: unknown): StatementEvalSourceType | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value === "telegram" ||
    value === "party" ||
    value === "web" ||
    value === "x"
  ) {
    return value;
  }

  throw new StatementEvalRunRequestError("Invalid sourceType.");
}

function parseOptionalVariantKeys(value: unknown) {
  if (!value) {
    return undefined;
  }

  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : null;

  if (!values) {
    throw new StatementEvalRunRequestError("Invalid variantKeys.");
  }

  const keys = values
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (keys.some((key) => !isStatementEvalVariantKey(key))) {
    throw new StatementEvalRunRequestError("Invalid variantKeys.");
  }

  return keys as StatementEvalVariantKey[];
}

class StatementEvalRunRequestError extends Error {}
