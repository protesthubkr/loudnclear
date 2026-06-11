import "server-only";

import { getStatementExtractionMaxAttempts } from "@/lib/telegram-statements/extraction-config";
import {
  extractTelegramStatementSentence,
  TelegramStatementExtractionConfigError,
  TelegramStatementExtractionRequestError,
  TelegramStatementInconsistentOutputError,
  TelegramStatementSentenceNotFoundError,
} from "@/lib/telegram-statements/extractor";
import { compactStatementExtractionIfUseful } from "@/lib/telegram-statements/sentence-compaction";
import {
  getRequiredXStatementSupabaseClient,
  getXStatementPostText,
  markXStatementExtractionAttemptStarted,
  markXStatementSummaryExtracted,
  markXStatementSummaryFailed,
  markXStatementSummarySkipped,
  type XStatementSummaryRow,
} from "./repository";

export type XStatementExtractionStatus =
  | "already_extracted"
  | "extracted"
  | "failed"
  | "skipped";

export async function processXStatementSummary(
  summary: XStatementSummaryRow,
): Promise<XStatementExtractionStatus> {
  if (summary.status === "extracted") {
    return "already_extracted";
  }

  const supabase = getRequiredXStatementSupabaseClient();

  if (summary.attempt_count >= getStatementExtractionMaxAttempts()) {
    await markXStatementSummaryFailed({
      errorMessage: "max_attempts_exceeded",
      summaryId: summary.id,
      supabase,
    });
    return "failed";
  }

  await markXStatementExtractionAttemptStarted({
    attemptCount: summary.attempt_count,
    summaryId: summary.id,
    supabase,
  });

  const post = await getXStatementPostText({
    postId: summary.post_id,
    supabase,
  });

  if (!post?.text_snapshot?.trim()) {
    await markXStatementSummarySkipped({
      errorMessage: "missing_text_snapshot",
      summaryId: summary.id,
      supabase,
    });
    return "skipped";
  }

  try {
    const rawExtraction = await extractTelegramStatementSentence({
      documentTypeHint: summary.document_type,
      organizationName: summary.organization_name,
      sourceUrl: summary.source_url,
      textSnapshot: post.text_snapshot,
    });
    const extraction = await compactStatementExtractionIfUseful({
      extraction: rawExtraction,
      textSnapshot: post.text_snapshot,
    });

    if (!extraction.isTargetDocument || !extraction.coreSentence.trim()) {
      await markXStatementSummarySkipped({
        errorMessage: extraction.reason || "not_target_document",
        model: extraction.model,
        promptVersion: extraction.promptVersion,
        summaryId: summary.id,
        supabase,
      });
      return "skipped";
    }

    if (
      extraction.coreSentenceStart === null ||
      extraction.coreSentenceEnd === null
    ) {
      throw new TelegramStatementSentenceNotFoundError(
        extraction.coreSentence,
      );
    }

    await markXStatementSummaryExtracted({
      confidence: extraction.confidence,
      coreSentence: extraction.coreSentence,
      coreSentenceEnd: extraction.coreSentenceEnd,
      coreSentenceStart: extraction.coreSentenceStart,
      documentType: extraction.documentType,
      model: extraction.model,
      promptVersion: extraction.promptVersion,
      reason: extraction.reason,
      summaryId: summary.id,
      supabase,
    });

    return "extracted";
  } catch (error) {
    await markXStatementSummaryFailed({
      errorMessage: getXStatementExtractionErrorMessage(error),
      summaryId: summary.id,
      supabase,
    });
    return "failed";
  }
}

export function getXStatementExtractionErrorMessage(error: unknown) {
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
