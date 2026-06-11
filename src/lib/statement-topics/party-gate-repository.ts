import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { roundSimilarity } from "./repository-utils";

const TOPIC_MATCH_CLEANUP_CHUNK_SIZE = 500;

export async function markPartyStatementTopicMatched({
  confidence,
  summaryId,
  supabase,
  topicId,
}: {
  confidence: number;
  summaryId: string;
  supabase: SupabaseClient;
  topicId: string;
}) {
  const { error } = await supabase
    .from("party_statement_summaries")
    .update({
      matched_topic_id: topicId,
      topic_gate_status: "matched",
      topic_match_confidence: roundSimilarity(confidence),
      topic_match_method: "embedding",
      topic_matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markPartyStatementTopicUnmatched({
  summaryId,
  supabase,
}: {
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const { error: linkError } = await supabase
    .from("statement_topic_links")
    .delete()
    .eq("source_type", "party")
    .eq("source_summary_id", summaryId)
    .eq("matched_by", "embedding");

  if (linkError) {
    throw new Error(linkError.message);
  }

  const { error } = await supabase
    .from("party_statement_summaries")
    .update({
      matched_topic_id: null,
      topic_gate_status: "unmatched",
      topic_match_confidence: null,
      topic_match_method: "embedding",
      topic_matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function clearLowConfidencePartyTopicMatches({
  minimumConfidence,
  supabase,
}: {
  minimumConfidence: number;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("party_statement_summaries")
    .select("id")
    .eq("topic_gate_status", "matched")
    .or(`topic_match_confidence.is.null,topic_match_confidence.lt.${minimumConfidence}`);

  if (error) {
    throw new Error(error.message);
  }

  const summaryIds = ((data as Array<{ id: string }> | null) ?? []).map(
    (row) => row.id,
  );

  for (const summaryIdChunk of chunk(summaryIds, TOPIC_MATCH_CLEANUP_CHUNK_SIZE)) {
    const { error: linkError } = await supabase
      .from("statement_topic_links")
      .delete()
      .eq("source_type", "party")
      .eq("matched_by", "embedding")
      .in("source_summary_id", summaryIdChunk);

    if (linkError) {
      throw new Error(linkError.message);
    }

    const { error: updateError } = await supabase
      .from("party_statement_summaries")
      .update({
        matched_topic_id: null,
        topic_gate_status: "unmatched",
        topic_match_confidence: null,
        topic_match_method: "embedding",
        topic_matched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", summaryIdChunk);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return summaryIds.length;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
