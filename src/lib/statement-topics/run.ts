import "server-only";

import {
  getStatementTopicRunLimit,
  getStatementTopicPartyThreshold,
  getStatementTopicWindowHours,
} from "./config";
import { clusterPrimarySummaries, toConfirmedTopic } from "./clustering";
import { embedPartyTopicRows, embedPrimaryTopicRows } from "./embedding-prep";
import { matchPartySummariesToTopics } from "./party-matching";
import {
  getRecentPartyTopicSummaries,
  getRecentTelegramTopicSummaries,
  getRecentXTopicSummaries,
  getRequiredStatementTopicSupabaseClient,
  clearLowConfidencePartyTopicMatches,
  markExpiredStatementTopics,
} from "./repository";
import type {
  StatementTopicRunOptions,
  StatementTopicRunResult,
} from "./run-types";
import { saveConfirmedPrimaryTopics } from "./topic-persistence";
import type { ConfirmedTopic } from "./types";

export { getStatementTopicErrorMessage } from "./run-error";
export type { StatementTopicRunOptions, StatementTopicRunResult } from "./run-types";

export async function runStatementTopicMatching(
  options: StatementTopicRunOptions = {},
): Promise<StatementTopicRunResult> {
  const dryRun = options.dryRun ?? false;
  const limit = options.limit ?? getStatementTopicRunLimit();
  const windowHours = options.windowHours ?? getStatementTopicWindowHours();
  const cutoffIso = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const supabase = getRequiredStatementTopicSupabaseClient();
  const telegramRows = await getRecentTelegramTopicSummaries({
    cutoffIso,
    limit,
    supabase,
  });
  const xRows = await getRecentXTopicSummaries({
    cutoffIso,
    limit,
    supabase,
  });
  const primaryRows = [...telegramRows, ...xRows].sort(
    comparePrimaryRowsByDisplayAtDesc,
  );
  const partyRows = await getRecentPartyTopicSummaries({
    cutoffIso,
    limit,
    supabase,
  });
  const result: StatementTopicRunResult = {
    confirmedTopics: 0,
    dryRun,
    embeddingsCreated: 0,
    matchedPartyStatements: 0,
    partyCandidatesSeen: partyRows.length,
    primaryClusters: 0,
    primarySummariesSeen: primaryRows.length,
    stalePartyMatchesCleared: 0,
    partyUnmatched: 0,
    telegramSummariesSeen: telegramRows.length,
    windowHours,
    xSummariesSeen: xRows.length,
  };

  if (dryRun) {
    return result;
  }

  result.stalePartyMatchesCleared = await clearLowConfidencePartyTopicMatches({
    minimumConfidence: getStatementTopicPartyThreshold(),
    supabase,
  });

  if (primaryRows.length === 0) {
    return result;
  }

  await markExpiredStatementTopics({ cutoffIso, supabase });

  const primaryEmbedded = await embedPrimaryTopicRows(primaryRows);
  result.embeddingsCreated += primaryEmbedded.created;

  const clusters = clusterPrimarySummaries(primaryEmbedded.rows);
  const confirmedTopics = clusters
    .map(toConfirmedTopic)
    .filter((topic): topic is ConfirmedTopic => Boolean(topic));

  result.primaryClusters = clusters.length;
  result.confirmedTopics = confirmedTopics.length;

  const activeTopics = await saveConfirmedPrimaryTopics({
    confirmedTopics,
    supabase,
  });

  if (partyRows.length === 0) {
    return result;
  }

  const partyEmbedded = await embedPartyTopicRows(partyRows);
  result.embeddingsCreated += partyEmbedded.created;

  const partyMatching = await matchPartySummariesToTopics({
    activeTopics,
    embeddedPartyRows: partyEmbedded.rows,
    supabase,
  });

  result.matchedPartyStatements += partyMatching.matchedPartyStatements;
  result.partyUnmatched += partyMatching.partyUnmatched;

  return result;
}

function comparePrimaryRowsByDisplayAtDesc(
  left: { display_at: string | null },
  right: { display_at: string | null },
) {
  const leftTime = left.display_at ? Date.parse(left.display_at) : 0;
  const rightTime = right.display_at ? Date.parse(right.display_at) : 0;

  return rightTime - leftTime;
}
