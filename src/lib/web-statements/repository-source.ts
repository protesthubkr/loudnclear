import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WebStatementSourceDefinition,
  WebStatementSourceKey,
} from "./types";

export async function upsertWebStatementSource({
  source,
  supabase,
}: {
  source: WebStatementSourceDefinition;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase.from("web_statement_sources").upsert(
    {
      enabled: true,
      list_url: source.listUrl,
      organization_name: source.organizationName,
      source_key: source.sourceKey,
      source_url: source.sourceUrl,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "source_key",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function markWebStatementSourceScanFinished({
  errorMessage,
  sourceKey,
  supabase,
}: {
  errorMessage?: string;
  sourceKey: WebStatementSourceKey;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("web_statement_sources")
    .update({
      last_error: errorMessage ?? null,
      last_scanned_at: now,
      updated_at: now,
    })
    .eq("source_key", sourceKey);

  if (error) {
    throw new Error(error.message);
  }
}
