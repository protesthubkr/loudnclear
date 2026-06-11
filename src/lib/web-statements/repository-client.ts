import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export function getRequiredWebStatementSupabaseClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase admin configuration.");
  }

  return supabase;
}
