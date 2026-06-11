import type {
  StatementSentenceRole,
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionRow,
  StatementSentenceSelectionSourceType,
} from "@/lib/statement-sentence-selections/types";

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
  confidence: number;
  core_sentence: string | null;
  display_sentence: string | null;
  final_status: Exclude<StatementDisplayDecisionFinalStatus, "failed">;
  reason: string;
  selected_mode: StatementDisplayDecisionMode;
  selected_sentence_id: string | null;
  sentence_role: StatementSentenceRole | null;
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
  selectedCandidate: StatementSentenceSelectionCandidate | null;
  status: StatementDisplayDecisionFinalStatus;
};

export type StatementDisplayDecisionRunOptions = {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  sourceType?: StatementSentenceSelectionSourceType;
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
  sourceType: StatementSentenceSelectionSourceType;
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
  sourceType: StatementSentenceSelectionSourceType;
  topicLabel: string | null;
};

export type {
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionRow,
  StatementSentenceSelectionSourceType,
};
