import "server-only";

import type {
  OpsSupabaseClient,
  SourceSummaryCounts,
} from "./ops-types";

export async function getSummaryCountsBySource(
  supabase: OpsSupabaseClient,
  table: string,
  sourceColumn: string,
  sinceIso: string,
): Promise<Map<string, SourceSummaryCounts>> {
  const { data, error } = await supabase
    .from(table)
    .select(`${sourceColumn},status,updated_at`)
    .gte("updated_at", sinceIso);

  if (error) {
    throw new Error(error.message);
  }

  const countsBySource = new Map<string, SourceSummaryCounts>();

  for (const row of ((data ?? []) as unknown) as Array<
    Record<string, unknown>
  >) {
    const sourceKey = row[sourceColumn];
    const status = row.status;

    if (typeof sourceKey !== "string" || typeof status !== "string") {
      continue;
    }

    const counts = countsBySource.get(sourceKey) ?? getEmptySourceCounts();
    incrementSourceCount(counts, status);
    countsBySource.set(sourceKey, counts);
  }

  return countsBySource;
}

export function getEmptySourceCounts(): SourceSummaryCounts {
  return {
    extracted: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
  };
}

function incrementSourceCount(counts: SourceSummaryCounts, status: string) {
  if (status === "extracted") {
    counts.extracted += 1;
    return;
  }

  if (status === "failed") {
    counts.failed += 1;
    return;
  }

  if (status === "skipped") {
    counts.skipped += 1;
    return;
  }

  if (status === "pending" || status === "queued") {
    counts.pending += 1;
  }
}
