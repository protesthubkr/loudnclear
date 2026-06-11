import type { TelegramStatementDocumentType } from "./types";

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

export type StatementExtractionModelOutput = {
  confidence: number;
  core_sentence: string;
  displayable: boolean;
  document_type: TelegramStatementDocumentType;
  is_target_document: boolean;
  reason: string;
  selected_candidate_id: string | null;
  sentence_role: StatementSentenceRole;
  stance_action: string | null;
  target_subject: string | null;
};

export type TelegramStatementSentenceExtractionResult = {
  confidence: number;
  coreSentence: string;
  coreSentenceEnd: number | null;
  coreSentenceStart: number | null;
  displayable: boolean;
  documentType: TelegramStatementDocumentType;
  isTargetDocument: boolean;
  model: string;
  promptVersion: string;
  reason: string;
  sentenceRole: StatementSentenceRole;
  stanceAction: string | null;
  targetSubject: string | null;
};

export type StatementExtractionGuidance = "people_power_strong_expression";

export type ExtractTelegramStatementSentenceInput = {
  documentTypeHint: TelegramStatementDocumentType;
  extractionGuidance?: StatementExtractionGuidance;
  organizationName: string;
  sourceUrl: string;
  textSnapshot: string;
};
