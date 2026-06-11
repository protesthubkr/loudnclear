import type {
  PartyTopicSummaryRow,
  PrimaryTopicSummaryRow,
} from "./repository-types";

export type EmbeddedPrimarySummary = PrimaryTopicSummaryRow & {
  embedding: number[];
  embeddingText: string;
};

export type EmbeddedPartySummary = PartyTopicSummaryRow & {
  embedding: number[];
  embeddingText: string;
};

export type TopicCluster = {
  centroid: number[];
  members: EmbeddedPrimarySummary[];
};

export type ConfirmedTopic = TopicCluster & {
  sourceCount: number;
  topicKey: string;
};

export type TopicLexicalSource = {
  core_sentence: string;
  text_snapshot?: string | null;
  title?: string | null;
};
