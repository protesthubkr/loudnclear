import "server-only";

import { BATCH_ENDPOINT, type PrepareStatementForBatchParams } from "./batch-types";
import { getStatementExtractionMaxAttempts } from "./extraction-config";
import { buildTelegramStatementExtractionRequestBody } from "./extractor";
import {
  getRequiredSupabaseAdminClient,
  getTelegramStatementMessageText,
  markStatementSummaryFailed,
  markStatementSummarySkipped,
} from "./repository";

export async function prepareStatementForBatch({
  dryRun,
  lines,
  model,
  result,
  summary,
}: PrepareStatementForBatchParams) {
  const supabase = getRequiredSupabaseAdminClient();

  if (summary.attempt_count >= getStatementExtractionMaxAttempts()) {
    if (!dryRun) {
      await markStatementSummaryFailed({
        errorMessage: "max_attempts_exceeded",
        summaryId: summary.id,
        supabase,
      });
    }

    result.failed += 1;
    return null;
  }

  const message = await getTelegramStatementMessageText({
    channelUsername: summary.channel_username,
    messageId: summary.message_id,
    supabase,
  });

  if (!message?.text_snapshot.trim()) {
    if (!dryRun) {
      await markStatementSummarySkipped({
        errorMessage: "missing_text_snapshot",
        summaryId: summary.id,
        supabase,
      });
    }

    result.skipped += 1;
    return null;
  }

  const extractionInput = {
    documentTypeHint: summary.document_type,
    organizationName: summary.organization_name,
    sourceUrl: summary.source_url,
    textSnapshot: message.text_snapshot,
  };

  const customId = `summary:${summary.id}`;
  lines.push(
    JSON.stringify({
      body: buildTelegramStatementExtractionRequestBody(extractionInput, model),
      custom_id: customId,
      method: "POST",
      url: BATCH_ENDPOINT,
    }),
  );

  return {
    channelUsername: summary.channel_username,
    customId,
    messageId: summary.message_id,
    organizationName: summary.organization_name,
    summaryId: summary.id,
  };
}
