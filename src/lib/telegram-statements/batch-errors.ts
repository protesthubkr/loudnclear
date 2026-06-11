import "server-only";

import {
  TelegramStatementExtractionConfigError,
  TelegramStatementInconsistentOutputError,
  TelegramStatementExtractionRequestError,
  TelegramStatementSentenceNotFoundError,
} from "./extractor";

export function getBatchErrorMessage(error: unknown) {
  if (error instanceof TelegramStatementExtractionConfigError) {
    return "missing_openai_api_key";
  }

  if (error instanceof TelegramStatementSentenceNotFoundError) {
    return "core_sentence_not_found";
  }

  if (error instanceof TelegramStatementInconsistentOutputError) {
    return `model_output_inconsistent:${error.reason}`;
  }

  if (error instanceof TelegramStatementExtractionRequestError) {
    return `openai_request_failed:${error.status}`;
  }

  return error instanceof Error ? error.message : String(error);
}
