import type { TelegramStatementDocumentType } from "./types";

export type StatementExtractionModelOutput = {
  confidence: number;
  core_sentence: string;
  document_type: TelegramStatementDocumentType;
  is_target_document: boolean;
  reason: string;
};

export type TelegramStatementSentenceExtractionResult = {
  confidence: number;
  coreSentence: string;
  coreSentenceEnd: number | null;
  coreSentenceStart: number | null;
  documentType: TelegramStatementDocumentType;
  isTargetDocument: boolean;
  model: string;
  promptVersion: string;
  reason: string;
};

export type StatementExtractionGuidance = "people_power_strong_expression";

export type ExtractTelegramStatementSentenceInput = {
  documentTypeHint: TelegramStatementDocumentType;
  extractionGuidance?: StatementExtractionGuidance;
  organizationName: string;
  sourceUrl: string;
  textSnapshot: string;
};
