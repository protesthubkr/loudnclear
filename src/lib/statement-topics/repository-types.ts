export type TopicSourceType = "party" | "telegram" | "web" | "x";
export type PrimaryTopicSourceType = "telegram" | "web" | "x";

export type TelegramTopicSummaryRow = {
  channel_username: string;
  core_sentence: string;
  document_type: string;
  extraction_confidence: number | null;
  id: string;
  message_id: number;
  message_created_at: string | null;
  organization_name: string;
  source_url: string;
  text_snapshot: string;
};

export type XTopicSummaryRow = {
  core_sentence: string;
  document_type: string;
  extraction_confidence: number | null;
  id: string;
  organization_name: string;
  post_id: string;
  posted_at: string | null;
  source_key: string;
  source_url: string;
  text_snapshot: string;
  x_post_id: string;
};

export type WebTopicSummaryRow = {
  core_sentence: string;
  document_id: string;
  document_type: string;
  external_id: string;
  extraction_confidence: number | null;
  id: string;
  organization_name: string;
  published_at: string | null;
  source_key: string;
  source_url: string;
  text_snapshot: string;
  title: string;
};

export type PrimaryTopicSummaryRow = {
  core_sentence: string;
  display_at: string | null;
  document_type: string;
  extraction_confidence: number | null;
  id: string;
  organization_name: string;
  source_key: string;
  source_type: PrimaryTopicSourceType;
  source_url: string;
  text_snapshot: string;
  title: string | null;
};

export type PartyTopicSummaryRow = {
  core_sentence: string;
  document_id: string;
  document_type: string;
  extraction_confidence: number | null;
  id: string;
  organization_name: string;
  published_at: string | null;
  source_key: string;
  source_url: string;
  text_snapshot: string;
  title: string;
  topic_gate_status: string | null;
};

export type TopicEmbeddingRow = {
  content_hash: string;
  embedding: number[];
  embedding_dimensions: number;
  embedding_model: string;
  source_summary_id: string;
  source_type: TopicSourceType;
};

export type StatementTopicRow = {
  id: string;
  topic_key: string;
};

export type UpsertStatementTopicInput = {
  centroidEmbedding: number[];
  embeddingDimensions: number;
  embeddingModel: string;
  metadata: Record<string, unknown>;
  representativeSourceUrl: string;
  representativeSummaryId: string;
  telegramMessageCount: number;
  telegramSourceCount: number;
  title: string;
  topicKey: string;
  windowEndedAt: string;
  windowStartedAt: string;
};

export type UpsertStatementTopicLinkInput = {
  similarity: number;
  sourceKey: string;
  sourceSummaryId: string;
  sourceType: TopicSourceType;
  sourceUrl: string;
  topicId: string;
};
