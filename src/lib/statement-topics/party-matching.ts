import "server-only";

import { getStatementTopicPartyThreshold } from "./config";
import { findBestTopicMatch } from "./clustering";
import { hasTopicLexicalSupportWithCluster } from "./lexical-support";
import {
  getRequiredStatementTopicSupabaseClient,
  markPartyStatementTopicMatched,
  markPartyStatementTopicUnmatched,
  upsertStatementTopicLinks,
} from "./repository";
import type { EmbeddedPartySummary } from "./types";
import type { SavedConfirmedTopic } from "./topic-persistence";

export type PartyTopicMatchingResult = {
  crossSourceMatches: number;
  matchedPartyStatements: number;
  partyUnmatched: number;
};

export async function matchPartySummariesToTopics({
  activeTopics,
  embeddedPartyRows,
  supabase,
}: {
  activeTopics: SavedConfirmedTopic[];
  embeddedPartyRows: EmbeddedPartySummary[];
  supabase: ReturnType<typeof getRequiredStatementTopicSupabaseClient>;
}): Promise<PartyTopicMatchingResult> {
  const result: PartyTopicMatchingResult = {
    crossSourceMatches: 0,
    matchedPartyStatements: 0,
    partyUnmatched: 0,
  };

  for (const row of embeddedPartyRows) {
    if (row.topic_gate_status === "manual_hidden") {
      continue;
    }

    const best = findBestTopicMatch(row.embedding, activeTopics);

    if (
      best &&
      best.similarity >= getStatementTopicPartyThreshold() &&
      hasTopicLexicalSupportWithCluster(row, best.topic, best.similarity)
    ) {
      await upsertStatementTopicLinks({
        links: [
          {
            similarity: best.similarity,
            sourceKey: row.source_key,
            sourceSummaryId: row.id,
            sourceType: "party",
            sourceUrl: row.source_url,
            topicId: best.topic.id,
          },
        ],
        supabase,
      });
      await markPartyStatementTopicMatched({
        confidence: best.similarity,
        summaryId: row.id,
        supabase,
        topicId: best.topic.id,
      });
      result.matchedPartyStatements += 1;
      continue;
    }

    await markPartyStatementTopicUnmatched({
      summaryId: row.id,
      supabase,
    });
    result.partyUnmatched += 1;
  }

  return result;
}
