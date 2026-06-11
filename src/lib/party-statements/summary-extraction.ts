import "server-only";

import { getStatementExtractionMaxAttempts } from "@/lib/telegram-statements/extraction-config";
import {
  extractTelegramStatementSentence,
  TelegramStatementExtractionConfigError,
  TelegramStatementInconsistentOutputError,
  TelegramStatementExtractionRequestError,
  TelegramStatementSentenceNotFoundError,
} from "@/lib/telegram-statements/extractor";
import { compactStatementExtractionIfUseful } from "@/lib/telegram-statements/sentence-compaction";
import {
  getPartyStatementDocumentText,
  getRequiredPartyStatementSupabaseClient,
  markPartyStatementExtractionAttemptStarted,
  markPartyStatementSummaryExtracted,
  markPartyStatementSummaryFailed,
  markPartyStatementSummarySkipped,
  type PartyStatementSummaryRow,
} from "./repository";
import type { PartyStatementExtractionStatus } from "./run-types";

export async function processPartyStatementSummary(
  summary: PartyStatementSummaryRow,
): Promise<PartyStatementExtractionStatus> {
  const supabase = getRequiredPartyStatementSupabaseClient();

  if (summary.attempt_count >= getStatementExtractionMaxAttempts()) {
    await markPartyStatementSummaryFailed({
      errorMessage: "max_attempts_exceeded",
      summaryId: summary.id,
      supabase,
    });
    return "failed";
  }

  await markPartyStatementExtractionAttemptStarted({
    attemptCount: summary.attempt_count,
    summaryId: summary.id,
    supabase,
  });

  const textSnapshot = await getPartyStatementDocumentText({
    documentId: summary.document_id,
    supabase,
  });

  if (!textSnapshot.trim()) {
    await markPartyStatementSummarySkipped({
      errorMessage: "missing_text_snapshot",
      summaryId: summary.id,
      supabase,
    });
    return "skipped";
  }

  try {
    const extractionInput = {
      documentTypeHint: summary.document_type,
      extractionGuidance: getPartyStatementExtractionGuidance(summary),
      organizationName: summary.organization_name,
      sourceUrl: summary.source_url,
      textSnapshot,
    };
    const rawExtraction = await extractTelegramStatementSentence(extractionInput);
    const extraction = await compactStatementExtractionIfUseful({
      extraction: rawExtraction,
      textSnapshot,
    });

    if (!extraction.isTargetDocument || !extraction.coreSentence.trim()) {
      await markPartyStatementSummarySkipped({
        errorMessage: extraction.reason || "not_target_document",
        model: extraction.model,
        promptVersion: extraction.promptVersion,
        summaryId: summary.id,
        supabase,
      });
      return "skipped";
    }

    if (isClearlyInvalidPartyCoreSentence(extraction.coreSentence)) {
      await markPartyStatementSummarySkipped({
        errorMessage: "invalid_core_sentence",
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

    await markPartyStatementSummaryExtracted({
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
    await markPartyStatementSummaryFailed({
      errorMessage: getPartyStatementErrorMessage(error),
      summaryId: summary.id,
      supabase,
    });
    return "failed";
  }
}

function getPartyStatementExtractionGuidance(summary: PartyStatementSummaryRow) {
  if (summary.source_key === "people_power_party") {
    return "people_power_strong_expression" as const;
  }

  return undefined;
}

function isClearlyInvalidPartyCoreSentence(coreSentence: string) {
  return /^(국민의힘\s*)?([가-힣]+\s*){0,3}(중앙선대위\s*)?(원내수석대변인|수석대변인|대변인|부대변인|공보단장)\s*[가-힣\s]{2,10}$/.test(
    coreSentence.replace(/\s+/g, " ").trim(),
  );
}

export function getPartyStatementErrorMessage(error: unknown) {
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
