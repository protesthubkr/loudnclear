import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyTelegramStatementMessages } from "./classifier";
import {
  collectBackfillTelegramStatementMessages,
  collectNewTelegramStatementMessages,
} from "./message-collection";
import {
  getTelegramStatementScanState,
  lockTelegramStatementScanState,
  markTelegramStatementScanFailed,
  markTelegramStatementScanSucceeded,
  upsertTelegramStatementMessages,
  upsertTelegramStatementSummaryCandidates,
} from "./repository";
import { isStateLocked } from "./run-config";
import type {
  TelegramStatementChannelResult,
  TelegramStatementFeedSubscription,
} from "./types";

export async function scanTelegramStatementChannel({
  backfill,
  cutoffIso,
  dryRun,
  maxPagesPerChannel,
  subscription,
  supabase,
}: {
  backfill: boolean;
  cutoffIso: string | null;
  dryRun: boolean;
  maxPagesPerChannel: number;
  subscription: TelegramStatementFeedSubscription;
  supabase: SupabaseClient;
}): Promise<TelegramStatementChannelResult> {
  const state = await getTelegramStatementScanState({
    channelUsername: subscription.channelUsername,
    supabase,
  });

  if (!backfill && isStateLocked(state)) {
    return {
      candidatesCreated: 0,
      candidateMatches: 0,
      channelTitle: subscription.channelTitle,
      channelUsername: subscription.channelUsername,
      cursorMessageId: state?.lastScannedMessageId ?? null,
      errorMessage: null,
      status: "skipped_locked",
      messagesSeen: 0,
      messagesWritten: 0,
      skippedBecauseLocked: true,
    };
  }

  if (!backfill) {
    await lockTelegramStatementScanState({
      channelUsername: subscription.channelUsername,
      dryRun,
      supabase,
    });
  }

  try {
    const scan = backfill
      ? await collectBackfillTelegramStatementMessages({
          cutoffIso: cutoffIso ?? new Date(0).toISOString(),
          enablePacing: !dryRun,
          maxPagesPerChannel,
          subscription,
        })
      : await collectNewTelegramStatementMessages({
          enablePacing: !dryRun,
          maxPagesPerChannel,
          state,
          subscription,
        });
    const candidates = classifyTelegramStatementMessages(scan.messages);
    const messagesWritten = await upsertTelegramStatementMessages({
      channelTitle: subscription.channelTitle,
      channelUsername: subscription.channelUsername,
      dryRun,
      messages: scan.messages,
      supabase,
    });
    const candidatesCreated = await upsertTelegramStatementSummaryCandidates({
      candidates,
      channelTitle: subscription.channelTitle,
      channelUsername: subscription.channelUsername,
      dryRun,
      supabase,
    });

    if (!backfill) {
      await markTelegramStatementScanSucceeded({
        channelUsername: subscription.channelUsername,
        cursorMessage: scan.cursorMessage,
        dryRun,
        supabase,
      });
    }

    return {
      candidatesCreated,
      candidateMatches: candidates.length,
      channelTitle: subscription.channelTitle,
      channelUsername: subscription.channelUsername,
      cursorMessageId: scan.cursorMessage?.messageId ?? null,
      errorMessage: null,
      messagesSeen: scan.messages.length,
      messagesWritten,
      skippedBecauseLocked: false,
      status: "succeeded",
    };
  } catch (error) {
    if (!backfill) {
      await markTelegramStatementScanFailed({
        channelUsername: subscription.channelUsername,
        dryRun,
        error,
        supabase,
      });
    }

    return {
      candidatesCreated: 0,
      candidateMatches: 0,
      channelTitle: subscription.channelTitle,
      channelUsername: subscription.channelUsername,
      cursorMessageId:
        state?.lastScannedMessageId ?? subscription.lastCheckedMessageId ?? null,
      errorMessage: getTelegramStatementChannelErrorMessage(error),
      messagesSeen: 0,
      messagesWritten: 0,
      skippedBecauseLocked: false,
      status: "failed",
    };
  }
}

function getTelegramStatementChannelErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
