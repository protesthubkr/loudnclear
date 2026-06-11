import { createHash } from "crypto";
import { getStatementTopicTelegramThreshold } from "./config";
import { averageEmbeddings, cosineSimilarity } from "./embedding";
import { hasTopicLexicalSupportWithCluster } from "./lexical-support";
import type {
  ConfirmedTopic,
  EmbeddedPrimarySummary,
  TopicCluster,
} from "./types";

export function clusterPrimarySummaries(rows: EmbeddedPrimarySummary[]) {
  const threshold = getStatementTopicTelegramThreshold();
  const clusters: TopicCluster[] = [];

  for (const row of rows) {
    const best = findBestCluster(row.embedding, clusters);

    if (
      best &&
      best.similarity >= threshold &&
      hasTopicLexicalSupportWithCluster(row, best.cluster, best.similarity)
    ) {
      best.cluster.members.push(row);
      best.cluster.centroid = averageEmbeddings(
        best.cluster.members.map((member) => member.embedding),
      );
      continue;
    }

    clusters.push({
      centroid: row.embedding,
      members: [row],
    });
  }

  return clusters;
}

export function toConfirmedTopic(cluster: TopicCluster) {
  const sourceCount = new Set(
    cluster.members.map((member) => `${member.source_type}:${member.source_key}`),
  ).size;

  if (sourceCount < 2) {
    return null;
  }

  const representative = cluster.members[0];

  if (!representative) {
    return null;
  }

  return {
    ...cluster,
    sourceCount,
    topicKey: buildTopicKey(cluster.members),
  };
}

export function findBestTopicMatch(
  embedding: number[],
  topics: Array<ConfirmedTopic & { id: string }>,
) {
  return topics
    .map((topic) => ({
      similarity: cosineSimilarity(embedding, topic.centroid),
      topic,
    }))
    .sort((first, second) => second.similarity - first.similarity)[0];
}

function findBestCluster(embedding: number[], clusters: TopicCluster[]) {
  return clusters
    .map((cluster) => ({
      cluster,
      similarity: cosineSimilarity(embedding, cluster.centroid),
    }))
    .sort((first, second) => second.similarity - first.similarity)[0];
}

function buildTopicKey(members: EmbeddedPrimarySummary[]) {
  const ids = members
    .map((member) => `${member.source_type}:${member.id}`)
    .sort()
    .join(":");

  return `primary:${createHash("sha256").update(ids).digest("hex").slice(0, 24)}`;
}
