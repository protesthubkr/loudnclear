import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceSelectionQueryOptions = {
  cutoffIso: string;
  limit: number;
  summaryId?: string;
  supabase: SupabaseClient;
};
