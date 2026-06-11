import type { SupabaseClient } from "@supabase/supabase-js";

export type TopicSummaryQueryOptions = {
  cutoffIso: string;
  limit: number;
  supabase: SupabaseClient;
};
