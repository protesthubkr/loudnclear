"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getRequiredStatementEvalSupabaseClient,
  upsertStatementEvalManualScore,
} from "@/lib/statement-evals/repository";
import { runStatementEvalLab } from "@/lib/statement-evals/run";
import type {
  StatementEvalSourceType,
  StatementEvalVariantKey,
} from "@/lib/statement-evals/types";
import { isStatementEvalVariantKey } from "@/lib/statement-evals/variants";

export async function runStatementEvalLabAction(formData: FormData) {
  const result = await runStatementEvalLab({
    limit: parseInteger(formData.get("limit"), 1, 500) ?? 10,
    sourceType: parseSourceType(formData.get("sourceType")),
    variantKeys: parseVariantKeys(formData),
    windowHours: parseInteger(formData.get("windowHours"), 1, 744) ?? 168,
  });

  if (result.runId) {
    redirect(`/ops/evals?runId=${result.runId}`);
  }

  redirect("/ops/evals");
}

export async function saveStatementEvalManualScoreAction(formData: FormData) {
  const runId = parseRequiredString(formData.get("runId"));
  const itemId = parseRequiredString(formData.get("itemId"));
  const supabase = getRequiredStatementEvalSupabaseClient();

  await upsertStatementEvalManualScore({
    cleansingScore: parseInteger(formData.get("cleansingScore"), 1, 5),
    compositionScore: parseInteger(formData.get("compositionScore"), 1, 5),
    feedScore: parseInteger(formData.get("feedScore"), 1, 5),
    isWinner: formData.get("isWinner") === "on",
    issueScore: parseInteger(formData.get("issueScore"), 1, 5),
    itemId,
    notes: parseOptionalString(formData.get("notes")),
    outputId: parseRequiredString(formData.get("outputId")),
    runId,
    stanceScore: parseInteger(formData.get("stanceScore"), 1, 5),
    supabase,
  });

  revalidatePath("/ops/evals");
  redirect(`/ops/evals?runId=${runId}`);
}

function parseVariantKeys(formData: FormData) {
  const keys = formData
    .getAll("variantKeys")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (keys.length === 0) {
    return undefined;
  }

  return keys.filter(isStatementEvalVariantKey) as StatementEvalVariantKey[];
}

function parseSourceType(value: FormDataEntryValue | null) {
  if (
    value === "telegram" ||
    value === "party" ||
    value === "web" ||
    value === "x"
  ) {
    return value as StatementEvalSourceType;
  }

  return undefined;
}

function parseInteger(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
) {
  if (value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(Math.max(parsed, min), max);
}

function parseRequiredString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Missing required form value.");
  }

  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
