import type { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type OpsSupabaseClient = NonNullable<
  ReturnType<typeof getSupabaseAdminClient>
>;

export type StatusCount = {
  extracted: number;
  failed: number;
  matched?: number;
  pending: number;
  skipped: number;
  unmatched?: number;
};

export type DisplayDecisionStatusCounts = {
  failed: number;
  rejected: number;
  review_needed: number;
  selected: number;
};

export type SourceHealthStatus =
  | "inactive"
  | "needs_attention"
  | "ok"
  | "unknown";

export type SourceSummaryCounts = {
  extracted: number;
  failed: number;
  pending: number;
  skipped: number;
};

export type DataSourceHealthCounts = Record<SourceHealthStatus, number>;

export type ScanRunRow = {
  candidates_created: number;
  channels_seen: number;
  error_message: string | null;
  finished_at: string | null;
  messages_seen: number;
  messages_written: number;
  started_at: string;
  status: string;
};

export type DataSourceRow = {
  enabled: boolean;
  health_reason: string;
  health_status: SourceHealthStatus;
  last_error: string | null;
  last_scanned_at: string | null;
  organization_name: string;
  recent_extracted_count: number;
  recent_failed_count: number;
  recent_pending_count: number;
  recent_skipped_count: number;
  source_key: string;
  source_type: "party" | "telegram" | "web" | "x";
  source_url: string;
  status: string;
};

export type DisplayDecisionReviewRow = {
  candidate_a_sentence: string | null;
  candidate_c_sentence: string | null;
  comparator_reason: string | null;
  confidence: number | null;
  core_sentence: string | null;
  display_at: string | null;
  display_sentence: string | null;
  final_status: "failed" | "rejected" | "review_needed" | "selected";
  id: string;
  last_error: string | null;
  organization_name: string;
  selected_mode: string | null;
  sentence_role: string | null;
  source_key: string;
  source_summary_id: string;
  source_type: DataSourceRow["source_type"];
  source_url: string;
  stance_clarity: string | null;
  subject_clarity: string | null;
  title: string | null;
  updated_at: string;
};

export type BaseDataSourceRow = Omit<
  DataSourceRow,
  | "health_reason"
  | "health_status"
  | "recent_extracted_count"
  | "recent_failed_count"
  | "recent_pending_count"
  | "recent_skipped_count"
>;

export type ProblemRow = {
  core_sentence?: string | null;
  last_error: string | null;
  organization_name: string;
  source_url: string;
  status: string;
  title?: string | null;
  updated_at: string;
};

export type PartyTopicRow = {
  core_sentence: string | null;
  organization_name: string;
  published_at: string | null;
  source_key: string;
  source_url: string;
  topic_gate_status: string;
  topic_match_confidence: number | null;
};

export type TopicRow = {
  status: string;
  telegram_message_count: number;
  telegram_source_count: number;
  title: string;
  window_ended_at: string;
};
