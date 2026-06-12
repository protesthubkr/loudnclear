import "server-only";

import { STATEMENT_DISPLAY_DECISION_PROMPT_VERSION } from "@/lib/statement-display-decisions/config";
import type {
  DisplayDecisionReviewRow,
  DisplayDecisionStatusCounts,
  OpsSupabaseClient,
} from "./ops-types";

const REVIEW_STATUSES = ["review_needed", "failed"] as const;

export async function getDisplayDecisionStatusCounts(
  supabase: OpsSupabaseClient,
): Promise<DisplayDecisionStatusCounts> {
  const [selected, reviewNeeded, rejected, failed] = await Promise.all([
    countDisplayDecisionRows(supabase, "selected"),
    countDisplayDecisionRows(supabase, "review_needed"),
    countDisplayDecisionRows(supabase, "rejected"),
    countDisplayDecisionRows(supabase, "failed"),
  ]);

  return {
    failed,
    rejected,
    review_needed: reviewNeeded,
    selected,
  };
}

export async function getDisplayDecisionReviewRows(
  supabase: OpsSupabaseClient,
): Promise<DisplayDecisionReviewRow[]> {
  const { data, error } = await supabase
    .from("statement_display_decisions")
    .select(
      [
        "id",
        "source_type",
        "source_summary_id",
        "source_key",
        "organization_name",
        "source_url",
        "title",
        "display_at",
        "final_status",
        "core_sentence",
        "display_sentence",
        "selected_mode",
        "sentence_role",
        "subject_clarity",
        "stance_clarity",
        "confidence",
        "comparator_reason",
        "last_error",
        "raw_comparator_output",
        "updated_at",
      ].join(","),
    )
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION)
    .in("final_status", REVIEW_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Array<
    Omit<DisplayDecisionReviewRow, "candidate_a_sentence" | "candidate_c_sentence"> & {
      raw_comparator_output: Record<string, unknown> | null;
    }
  >).map((row) => ({
    ...row,
    candidate_a_sentence: readRawString(
      row.raw_comparator_output,
      "candidate_a_sentence",
    ),
    candidate_c_sentence: readRawString(
      row.raw_comparator_output,
      "candidate_c_sentence",
    ),
  }));
}

async function countDisplayDecisionRows(
  supabase: OpsSupabaseClient,
  status: keyof DisplayDecisionStatusCounts,
) {
  const { count, error } = await supabase
    .from("statement_display_decisions")
    .select("*", { count: "exact", head: true })
    .eq("comparator_prompt_version", STATEMENT_DISPLAY_DECISION_PROMPT_VERSION)
    .eq("final_status", status);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

function readRawString(
  rawOutput: Record<string, unknown> | null,
  key: string,
) {
  const value = rawOutput?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}
