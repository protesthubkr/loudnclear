import { getSupabaseClient } from "@/lib/supabase";
import {
  compareStatementItemsNewestFirst,
  compareStatementItemsOldestFirst,
} from "./public-feed-time";
import {
  getPublicPartyStatementItems,
  getPublicTelegramStatementItems,
  hasPublicPartyStatementItemsBefore,
  hasPublicTelegramStatementItemsBefore,
} from "./public-feed-sources";
import type { PublicStatementFeedItem } from "./public-feed-types";

export type {
  PartyStatementSummaryPublicRow,
  PublicStatementFeedItem,
  StatementSummaryPublicRow,
} from "./public-feed-types";

export type PublicStatementFeedQuery = {
  fromIso?: string;
  limit?: number;
  toIso?: string;
};

export async function getPublicStatementFeedItems(
  query: number | PublicStatementFeedQuery = {},
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [] satisfies PublicStatementFeedItem[];
  }

  const normalizedQuery = normalizePublicStatementFeedQuery(query);
  const [telegramItems, partyItems] = await Promise.all([
    getPublicTelegramStatementItems(normalizedQuery),
    getPublicPartyStatementItems(normalizedQuery),
  ]);

  return [...telegramItems, ...partyItems]
    .sort(compareStatementItemsNewestFirst)
    .slice(0, normalizedQuery.limit)
    .sort(compareStatementItemsOldestFirst);
}

export async function hasPublicStatementFeedItemsBefore(beforeIso: string) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  const [hasTelegramItems, hasPartyItems] = await Promise.all([
    hasPublicTelegramStatementItemsBefore(beforeIso),
    hasPublicPartyStatementItemsBefore(beforeIso),
  ]);

  return hasTelegramItems || hasPartyItems;
}

function normalizePublicStatementFeedQuery(
  query: number | PublicStatementFeedQuery,
) {
  if (typeof query === "number") {
    return {
      limit: query,
    };
  }

  return {
    fromIso: query.fromIso,
    limit: query.limit ?? 100,
    toIso: query.toIso,
  };
}
