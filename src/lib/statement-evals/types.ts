import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export type StatementEvalSourceType = "telegram" | "party" | "web" | "x";

export type StatementEvalStatus =
  | "selected"
  | "review_needed"
  | "rejected"
  | "failed";

export type StatementEvalSummaryMode =
  | "single_span"
  | "issue_plus_stance"
  | "two_sentence";

export type StatementEvalIssueClarity = "clear" | "implied" | "missing";
export type StatementEvalStanceClarity = "clear" | "weak" | "missing";

export type StatementEvalVariantKey =
  | "conservative_single_span"
  | "title_issue_body_stance"
  | "role_tag_then_span"
  | "clause_level_strict";

export type StatementEvalSourceRow = {
  currentCoreSentence: string | null;
  currentDisplayPromptVersion: string | null;
  currentDisplaySentence: string | null;
  currentDisplayStatus: string | null;
  displayAt: string | null;
  documentType: TelegramStatementDocumentType;
  organizationName: string;
  sourceKey: string;
  sourceMetadata: Record<string, unknown>;
  sourceSummaryId: string;
  sourceType: StatementEvalSourceType;
  sourceUrl: string;
  textSnapshot: string;
  title: string | null;
};

export type StatementEvalCandidateSource = "title" | "body";

export type StatementEvalCandidateKind =
  | "title"
  | "lead"
  | "sentence"
  | "clause";

export type StatementEvalCandidate = {
  end: number;
  id: string;
  issueSignalCount: number;
  kind: StatementEvalCandidateKind;
  rank: number;
  source: StatementEvalCandidateSource;
  stanceSignalCount: number;
  start: number;
  text: string;
};

export type StatementEvalSpanRole = "issue" | "stance" | "combined";

export type StatementEvalPlannedSpan = {
  candidate_id: string;
  role: StatementEvalSpanRole;
  text: string;
};

export type StatementEvalPlannerOutput = {
  final_status: StatementEvalStatus;
  issue_clarity: StatementEvalIssueClarity;
  reason: string;
  role_tags: Array<{
    candidate_id: string;
    role: "issue" | "stance" | "combined" | "context" | "notice" | "bad";
  }>;
  spans: StatementEvalPlannedSpan[];
  stance_clarity: StatementEvalStanceClarity;
  summary_mode: StatementEvalSummaryMode;
};

export type StatementEvalVariant = {
  description: string;
  key: StatementEvalVariantKey;
  promptFocus: string[];
  version: string;
};

export type StatementEvalOutputDecision = {
  assembledSentence: string | null;
  candidateSnapshot: StatementEvalCandidate[];
  cleansedSentence: string | null;
  cleansingOk: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  extractiveOk: boolean;
  failureReason: string | null;
  finalStatus: StatementEvalStatus;
  hardGateOk: boolean;
  issueClarity: StatementEvalIssueClarity | null;
  issueSignalCount: number;
  issueText: string | null;
  lengthOk: boolean;
  metadataLeft: boolean;
  model: string | null;
  plannerOutput: StatementEvalPlannerOutput | null;
  plannerReason: string | null;
  rawPlannerOutput: unknown;
  reasoningEffort: string | null;
  spanPlan: StatementEvalPlannedSpan[];
  stanceClarity: StatementEvalStanceClarity | null;
  stanceSignalCount: number;
  stanceText: string | null;
  summaryMode: StatementEvalSummaryMode | null;
  variant: StatementEvalVariant;
};

export type StatementEvalRunOptions = {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  sourceType?: StatementEvalSourceType;
  summaryId?: string;
  variantKeys?: StatementEvalVariantKey[];
  windowHours?: number;
};

export type StatementEvalRunResult = {
  dryRun: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  failedOutputs: number;
  itemCount: number;
  outputCount: number;
  runId: string | null;
  selectedOutputs: number;
  variantKeys: StatementEvalVariantKey[];
  windowHours: number;
};

export type StatementEvalRunRow = {
  created_at: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_total_tokens: number;
  failed_output_count: number;
  id: string;
  item_count: number;
  output_count: number;
  selected_output_count: number;
  status: string;
  variant_keys: StatementEvalVariantKey[];
  window_ended_at: string;
  window_started_at: string;
};

export type StatementEvalOutputRow = {
  assembled_sentence: string | null;
  cleansing_ok: boolean;
  cleansed_sentence: string | null;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_total_tokens: number;
  extractive_ok: boolean;
  failure_reason: string | null;
  final_status: StatementEvalStatus;
  hard_gate_ok: boolean;
  id: string;
  issue_clarity: StatementEvalIssueClarity | null;
  issue_signal_count: number;
  issue_text: string | null;
  length_ok: boolean;
  metadata_left: boolean;
  planner_reason: string | null;
  stance_clarity: StatementEvalStanceClarity | null;
  stance_signal_count: number;
  stance_text: string | null;
  summary_mode: StatementEvalSummaryMode | null;
  variant_key: StatementEvalVariantKey;
  variant_version: string;
  manual_score: StatementEvalManualScoreRow | null;
};

export type StatementEvalManualScoreRow = {
  cleansing_score: number | null;
  composition_score: number | null;
  feed_score: number | null;
  is_winner: boolean;
  issue_score: number | null;
  notes: string | null;
  output_id: string;
  stance_score: number | null;
};

export type StatementEvalItemRow = {
  current_core_sentence: string | null;
  current_display_sentence: string | null;
  display_at: string | null;
  document_type: string;
  id: string;
  organization_name: string;
  outputs: StatementEvalOutputRow[];
  source_key: string;
  source_summary_id: string;
  source_type: StatementEvalSourceType;
  source_url: string;
  text_snapshot: string;
  title: string | null;
};

export type StatementEvalRunDetail = {
  items: StatementEvalItemRow[];
  run: StatementEvalRunRow;
};
