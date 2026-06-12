import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export type StatementDisplayDecisionSourceType =
  | "telegram"
  | "party"
  | "web"
  | "x";

export type StatementDisplaySentenceRole =
  | "demand"
  | "condemnation"
  | "criticism"
  | "welcome"
  | "concern"
  | "pledge"
  | "context"
  | "notice"
  | "tribute"
  | "resource_intro";

export type StatementDisplayCandidate = {
  id: string;
  kind: "title" | "lead" | "sentence" | "clause";
  rank: number;
  section: "title" | "lead" | "body";
  text: string;
};

export type StatementDisplaySourceRow = {
  id: string;
  sourceType: StatementDisplayDecisionSourceType;
  sourceSummaryId: string;
  sourceKey: string;
  organizationName: string;
  sourceUrl: string;
  title: string | null;
  documentType: TelegramStatementDocumentType;
  currentStatus: string;
  currentCoreSentence: string | null;
  currentExtractionConfidence: number | null;
  currentExtractionReason: string | null;
  currentModel: string | null;
  displayAt: string | null;
  textSnapshot: string;
};

export type StatementDisplayDecisionMode =
  | "sentence_only"
  | "label_plus_sentence"
  | "review_needed"
  | "rejected";

export type StatementDisplayDecisionFinalStatus =
  | "selected"
  | "review_needed"
  | "rejected"
  | "failed";

export type StatementDisplayDecisionSubjectClarity =
  | "clear"
  | "implied"
  | "missing";

export type StatementDisplayDecisionStanceClarity =
  | "clear"
  | "weak"
  | "missing";

export type StatementDisplayComparatorOutput = {
  candidate_a_sentence: string | null;
  candidate_a_source_ids: string[];
  candidate_c_sentence: string | null;
  candidate_c_source_ids: string[];
  chosen_candidate: "A" | "C" | "none";
  confidence: number;
  core_sentence: string | null;
  display_sentence: string | null;
  final_status: Exclude<StatementDisplayDecisionFinalStatus, "failed">;
  reason: string;
  selected_mode: StatementDisplayDecisionMode;
  selected_sentence_id: string | null;
  sentence_role: StatementDisplaySentenceRole | null;
  stance_action: string | null;
  stance_clarity: StatementDisplayDecisionStanceClarity;
  subject_clarity: StatementDisplayDecisionSubjectClarity;
  target_subject: string | null;
  topic_label: string | null;
};

export type StatementDisplayDecision = {
  candidateCount: number;
  comparatorOutput: StatementDisplayComparatorOutput | null;
  coreSentence: string | null;
  displaySentence: string | null;
  errorMessage: string | null;
  selectedCandidate: StatementDisplayCandidate | null;
  status: StatementDisplayDecisionFinalStatus;
};

export type StatementDisplayDecisionRunOptions = {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  retryFailed?: boolean;
  sourceType?: StatementDisplayDecisionSourceType;
  summaryId?: string;
  windowHours?: number;
};

export type StatementDisplayDecisionOutcome = {
  candidateCount?: number;
  currentCoreSentence?: string | null;
  displaySentence?: string | null;
  errorMessage?: string | null;
  finalStatus?: StatementDisplayDecisionFinalStatus;
  organizationName: string;
  selectedMode?: StatementDisplayDecisionMode | null;
  selectedSentence?: string | null;
  sourceKey: string;
  sourceSummaryId: string;
  sourceType: StatementDisplayDecisionSourceType;
  status:
    | "preview"
    | StatementDisplayDecisionFinalStatus
    | "skipped_existing";
  topicLabel?: string | null;
};

export type StatementDisplayDecisionRunResult = {
  dryRun: boolean;
  failed: number;
  force: boolean;
  outcomes: StatementDisplayDecisionOutcome[];
  rejected: number;
  retryFailed: boolean;
  reviewNeeded: number;
  rowsSeen: number;
  selected: number;
  skippedExisting: number;
  windowHours: number;
};

export type StatementDisplayFeedDecision = {
  coreSentence: string;
  displaySentence: string;
  sourceSummaryId: string;
  sourceType: StatementDisplayDecisionSourceType;
  topicLabel: string | null;
};
