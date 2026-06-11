import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export type StatementSentenceSelectionSourceType =
  | "telegram"
  | "party"
  | "web"
  | "x";

export type StatementSentenceSelectionFinalStatus =
  | "selected"
  | "rejected"
  | "review_needed"
  | "failed";

export type StatementSentenceRole =
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

export type StatementSentenceSelectionCandidate = {
  id: string;
  section: "title" | "body";
  text: string;
};

export type StatementSentenceSelectionRow = {
  id: string;
  sourceType: StatementSentenceSelectionSourceType;
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

export type StatementSentenceSelectorOutput = {
  confidence: number;
  displayable: boolean;
  is_target_document: boolean;
  reason: string;
  selected_sentence_id: string | null;
  sentence_role: StatementSentenceRole;
  stance_action: string | null;
  target_subject: string | null;
};

export type StatementSentenceVerifierOutput = {
  confidence: number;
  displayable: boolean;
  reason: string;
  sentence_role: StatementSentenceRole;
  stance_action: string | null;
  target_subject: string | null;
};

export type StatementSentenceSelectionDecision = {
  candidateCount: number;
  selectedCandidate: StatementSentenceSelectionCandidate | null;
  selectorOutput: StatementSentenceSelectorOutput | null;
  verifierOutput: StatementSentenceVerifierOutput | null;
  status: StatementSentenceSelectionFinalStatus;
  errorMessage: string | null;
};

export type StatementSentenceSelectionRunOptions = {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  sourceType?: StatementSentenceSelectionSourceType;
  summaryId?: string;
  windowHours?: number;
};

export type StatementSentenceSelectionOutcome = {
  candidateCount?: number;
  currentCoreSentence?: string | null;
  errorMessage?: string | null;
  finalStatus?: StatementSentenceSelectionFinalStatus;
  organizationName: string;
  selectedSentence?: string | null;
  sourceKey: string;
  sourceSummaryId: string;
  sourceType: StatementSentenceSelectionSourceType;
  status:
    | "preview"
    | StatementSentenceSelectionFinalStatus
    | "skipped_existing";
  verifierDisplayable?: boolean | null;
};

export type StatementSentenceSelectionRunResult = {
  dryRun: boolean;
  failed: number;
  force: boolean;
  outcomes: StatementSentenceSelectionOutcome[];
  rejected: number;
  reviewNeeded: number;
  rowsSeen: number;
  selected: number;
  skippedExisting: number;
  windowHours: number;
};
