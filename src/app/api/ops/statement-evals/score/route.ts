import { NextRequest, NextResponse } from "next/server";
import { isManualRunAuthorized, unauthorized } from "@/lib/ingest-route";
import {
  getRequiredStatementEvalSupabaseClient,
  upsertStatementEvalManualScore,
} from "@/lib/statement-evals/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isManualRunAuthorized(request)) {
    return unauthorized();
  }

  try {
    const body = await readBody(request);
    const supabase = getRequiredStatementEvalSupabaseClient();

    await upsertStatementEvalManualScore({
      cleansingScore: parseOptionalScore(body.cleansingScore),
      compositionScore: parseOptionalScore(body.compositionScore),
      feedScore: parseOptionalScore(body.feedScore),
      isWinner: parseOptionalBoolean(body.isWinner) ?? false,
      issueScore: parseOptionalScore(body.issueScore),
      itemId: parseRequiredString(body.itemId, "itemId"),
      notes: parseOptionalString(body.notes),
      outputId: parseRequiredString(body.outputId, "outputId"),
      runId: parseRequiredString(body.runId, "runId"),
      stanceScore: parseOptionalScore(body.stanceScore),
      supabase,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StatementEvalScoreRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Statement eval score failed"
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
    throw new StatementEvalScoreRequestError("JSON body is required.");
  }

  try {
    const body = JSON.parse(text) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new StatementEvalScoreRequestError("Invalid JSON body.");
    }

    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StatementEvalScoreRequestError) {
      throw error;
    }

    throw new StatementEvalScoreRequestError("Invalid JSON body.");
  }
}

function parseRequiredString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new StatementEvalScoreRequestError(`${name} is required.`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

  throw new StatementEvalScoreRequestError("Invalid boolean option.");
}

function parseOptionalScore(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new StatementEvalScoreRequestError("Scores must be 1-5.");
  }

  return parsed;
}

class StatementEvalScoreRequestError extends Error {}
