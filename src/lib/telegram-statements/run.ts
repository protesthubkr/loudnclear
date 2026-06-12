import "server-only";

import { scanTelegramStatementChannel } from "./channel-scan";
import {
  createTelegramStatementScanRun,
  finishTelegramStatementScanRun,
  getRequiredSupabaseAdminClient,
  getStatementFeedSubscriptions,
} from "./repository";
import {
  getMaxPagesPerChannel,
  getWindowHours,
  waitForTelegramStatementChannelDelay,
} from "./run-config";
import type {
  TelegramStatementRunOptions,
  TelegramStatementScanResult,
} from "./types";

export async function runTelegramStatementFeedScan(
  options: TelegramStatementRunOptions = {},
): Promise<TelegramStatementScanResult> {
  const supabase = getRequiredSupabaseAdminClient();
  const backfill = options.backfill ?? false;
  const dryRun = options.dryRun ?? false;
  const windowHours = backfill ? getWindowHours(options.windowHours) : null;
  const cutoffIso = windowHours
    ? new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    : null;
  const runId = await createTelegramStatementScanRun({ dryRun, supabase });
  const totals: TelegramStatementScanResult = {
    backfill,
    candidatesCreated: 0,
    candidateMatches: 0,
    channelsFailed: 0,
    channelsScanned: 0,
    channelsSkipped: 0,
    cutoffIso,
    dryRun,
    messagesSeen: 0,
    messagesWritten: 0,
    results: [],
    runId,
    windowHours,
  };
  let hasFinishedRun = false;

  try {
    const subscriptions = await getStatementFeedSubscriptions({
      channelUsername: options.channelUsername,
      supabase,
    });

    for (let index = 0; index < subscriptions.length; index += 1) {
      const subscription = subscriptions[index];
      const channelResult = await scanTelegramStatementChannel({
        backfill,
        cutoffIso,
        dryRun,
        maxPagesPerChannel: getMaxPagesPerChannel({
          backfill,
          optionValue: options.maxPagesPerChannel,
        }),
        subscription,
        supabase,
      });

      totals.results.push(channelResult);

      if (channelResult.skippedBecauseLocked) {
        totals.channelsSkipped += 1;
        continue;
      }

      if (channelResult.status === "failed") {
        totals.channelsFailed += 1;
        continue;
      }

      totals.channelsScanned += 1;
      totals.candidatesCreated += channelResult.candidatesCreated;
      totals.candidateMatches += channelResult.candidateMatches;
      totals.messagesSeen += channelResult.messagesSeen;
      totals.messagesWritten += channelResult.messagesWritten;

      if (!dryRun && index < subscriptions.length - 1) {
        await waitForTelegramStatementChannelDelay();
      }
    }

    const channelFailureMessage = getChannelFailureMessage(totals);
    const status =
      totals.channelsFailed > 0 &&
      totals.channelsScanned === 0 &&
      totals.channelsSkipped === 0
        ? "failed"
        : "succeeded";

    await finishRun({
      errorMessage: channelFailureMessage ?? undefined,
      metadata: getRunMetadata(totals),
      status,
      runId,
      supabase,
      totals,
    });
    hasFinishedRun = true;

    if (status === "failed") {
      throw new Error(channelFailureMessage ?? "Telegram statement ingest failed.");
    }

    return totals;
  } catch (error) {
    if (!hasFinishedRun) {
      await finishRun({
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: getRunMetadata(totals),
        status: "failed",
        runId,
        supabase,
        totals,
      });
    }

    throw error;
  }
}

async function finishRun({
  errorMessage,
  metadata,
  runId,
  status,
  supabase,
  totals,
}: {
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  runId: string | null;
  status: "failed" | "succeeded";
  supabase: ReturnType<typeof getRequiredSupabaseAdminClient>;
  totals: TelegramStatementScanResult;
}) {
  await finishTelegramStatementScanRun({
    errorMessage,
    metadata,
    runId,
    status,
    supabase,
    totals: {
      candidatesCreated: totals.candidatesCreated,
      channelsSeen: totals.channelsScanned,
      messagesSeen: totals.messagesSeen,
      messagesWritten: totals.messagesWritten,
    },
  });
}

function getChannelFailureMessage(totals: TelegramStatementScanResult) {
  const failures = totals.results.filter((result) => result.status === "failed");

  if (failures.length === 0) {
    return null;
  }

  const failedChannels = failures
    .map((failure) => `${failure.channelUsername}: ${failure.errorMessage ?? "failed"}`)
    .join("; ");

  return `${failures.length} telegram channel(s) failed: ${failedChannels}`;
}

function getRunMetadata(totals: TelegramStatementScanResult) {
  const failures = totals.results.filter((result) => result.status === "failed");

  if (failures.length === 0) {
    return undefined;
  }

  return {
    source: "telegram_statement_feed",
    channel_failures: failures.length,
    failed_channels: failures.map((failure) => ({
      channel_title: failure.channelTitle,
      channel_username: failure.channelUsername,
      error_message: failure.errorMessage,
    })),
  };
}
