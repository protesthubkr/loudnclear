import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPartySelectionRows } from "./repository-source-row-party";
import { getTelegramSelectionRows } from "./repository-source-row-telegram";
import { compareSelectionRowsByDisplayAtDesc } from "./repository-source-row-utils";
import { getWebSelectionRows } from "./repository-source-row-web";
import { getXSelectionRows } from "./repository-source-row-x";
import type { StatementSentenceSelectionSourceType } from "./types";

export async function getRowsForStatementSentenceSelection({
  cutoffIso,
  limit,
  sourceType,
  summaryId,
  supabase,
}: {
  cutoffIso: string;
  limit: number;
  sourceType?: StatementSentenceSelectionSourceType;
  summaryId?: string;
  supabase: SupabaseClient;
}) {
  const rows = (
    await Promise.all([
      sourceType && sourceType !== "telegram"
        ? Promise.resolve([])
        : getTelegramSelectionRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType && sourceType !== "party"
        ? Promise.resolve([])
        : getPartySelectionRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType && sourceType !== "web"
        ? Promise.resolve([])
        : getWebSelectionRows({ cutoffIso, limit, summaryId, supabase }),
      sourceType && sourceType !== "x"
        ? Promise.resolve([])
        : getXSelectionRows({ cutoffIso, limit, summaryId, supabase }),
    ])
  )
    .flat()
    .sort(compareSelectionRowsByDisplayAtDesc)
    .slice(0, limit);

  return rows;
}
