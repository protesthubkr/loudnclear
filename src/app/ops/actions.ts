"use server";

import { revalidatePath } from "next/cache";
import { STATEMENT_DISPLAY_DECISION_PROMPT_VERSION } from "@/lib/statement-display-decisions/config";
import { finalizeDisplaySentence } from "@/lib/statement-display-decisions/postprocess";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { clearPublicStatementFeedWindowCache } from "@/lib/telegram-statements/public-feed";

type ReviewChoice = "A" | "C" | "reject";

export async function reviewStatementDisplayDecisionAction(formData: FormData) {
  const decisionId = parseRequiredString(formData.get("decisionId"));
  const choice = parseReviewChoice(formData.get("choice"));
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase configuration.");
  }

  const { data, error } = await supabase
    .from("statement_display_decisions")
    .select(
      [
        "id",
        "raw_comparator_output",
        "display_sentence",
        "core_sentence",
      ].join(","),
    )
    .eq("id", decisionId)
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as unknown as {
    core_sentence: string | null;
    display_sentence: string | null;
    id: string;
    raw_comparator_output: Record<string, unknown> | null;
  };

  if (choice === "reject") {
    await updateDisplayDecisionRow(decisionId, {
      final_status: "rejected",
      last_error: null,
      raw_comparator_output: {
        ...(row.raw_comparator_output ?? {}),
        chosen_candidate: "none",
        manual_review: {
          action: "reject",
          reviewed_at: new Date().toISOString(),
        },
      },
      selected_mode: "rejected",
    });
    revalidateStatementReviewSurfaces();
    return;
  }

  const sentence = readCandidateSentence(row.raw_comparator_output, choice);
  const sourceIds = readCandidateSourceIds(row.raw_comparator_output, choice);
  const displaySentence = finalizeDisplaySentence(sentence);

  if (!displaySentence) {
    throw new Error(`Missing ${choice} candidate sentence.`);
  }

  await updateDisplayDecisionRow(decisionId, {
    core_sentence: displaySentence,
    display_sentence: displaySentence,
    final_status: "selected",
    last_error: null,
    raw_comparator_output: {
      ...(row.raw_comparator_output ?? {}),
      chosen_candidate: choice,
      core_sentence: displaySentence,
      display_sentence: displaySentence,
      final_status: "selected",
      manual_review: {
        action: `select_${choice}`,
        reviewed_at: new Date().toISOString(),
      },
      selected_mode: "sentence_only",
      selected_sentence_id: sourceIds[0] ?? null,
    },
    selected_mode: "sentence_only",
    selected_sentence_id: sourceIds[0] ?? null,
  });

  revalidateStatementReviewSurfaces();
}

function revalidateStatementReviewSurfaces() {
  clearPublicStatementFeedWindowCache();
  revalidatePath("/");
  revalidatePath("/ops");
}

async function updateDisplayDecisionRow(
  decisionId: string,
  values: Record<string, unknown>,
) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase configuration.");
  }

  const { error } = await supabase
    .from("statement_display_decisions")
    .update(values)
    .eq("id", decisionId)
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION);

  if (error) {
    throw new Error(error.message);
  }
}

function readCandidateSentence(
  rawOutput: Record<string, unknown> | null,
  choice: Exclude<ReviewChoice, "reject">,
) {
  const key =
    choice === "A" ? "candidate_a_sentence" : "candidate_c_sentence";
  const value = rawOutput?.[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${choice} candidate sentence.`);
  }

  return value.trim();
}

function readCandidateSourceIds(
  rawOutput: Record<string, unknown> | null,
  choice: Exclude<ReviewChoice, "reject">,
) {
  const key =
    choice === "A" ? "candidate_a_source_ids" : "candidate_c_source_ids";
  const value = rawOutput?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function parseRequiredString(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Missing required form value.");
  }

  return value.trim();
}

function parseReviewChoice(value: FormDataEntryValue | null): ReviewChoice {
  if (value === "A" || value === "C" || value === "reject") {
    return value;
  }

  throw new Error("Invalid review choice.");
}
