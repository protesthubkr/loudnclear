import { getSupabaseClient } from "@/lib/supabase";
import {
  compareStatementItemsNewestFirst,
  compareStatementItemsOldestFirst,
} from "./public-feed-time";
import {
  getConfirmedTelegramStatementSummaryIds,
  getPublicPartyStatementItems,
  getPublicTelegramStatementItems,
  hasPublicPartyStatementItemsBefore,
  hasPublicTelegramStatementItemsBefore,
} from "./public-feed-sources";
import type { PublicStatementFeedItem } from "./public-feed-types";

type PublicStatementFeedQuery = {
  fromIso?: string;
  limit?: number;
  toIso?: string;
};

type PublicStatementFeedWindowData = {
  hasMoreBefore: boolean;
  items: PublicStatementFeedItem[];
};

const PUBLIC_FEED_WINDOW_CACHE_TTL_MS = 60_000;
const publicFeedWindowCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<PublicStatementFeedWindowData>;
  }
>();

export async function getPublicStatementFeedWindow(
  query: PublicStatementFeedQuery,
) {
  const normalizedQuery = normalizePublicStatementFeedQuery(query);
  const cacheKey = getPublicStatementFeedWindowCacheKey(normalizedQuery);
  const now = Date.now();
  const cached = publicFeedWindowCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = loadPublicStatementFeedWindow(normalizedQuery).catch(
    (error: unknown) => {
      if (publicFeedWindowCache.get(cacheKey)?.promise === promise) {
        publicFeedWindowCache.delete(cacheKey);
      }

      throw error;
    },
  );

  publicFeedWindowCache.set(cacheKey, {
    expiresAt: now + PUBLIC_FEED_WINDOW_CACHE_TTL_MS,
    promise,
  });

  pruneExpiredPublicFeedWindowCache(now);

  return promise;
}

async function loadPublicStatementFeedWindow(
  query: Required<Pick<PublicStatementFeedQuery, "limit">> &
    Omit<PublicStatementFeedQuery, "limit">,
): Promise<PublicStatementFeedWindowData> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      hasMoreBefore: false,
      items: [],
    };
  }

  const confirmedTelegramSummaryIdsPromise =
    getConfirmedTelegramStatementSummaryIds(query.limit);
  const partyItemsPromise = getPublicPartyStatementItems(query);
  const hasPartyItemsBeforePromise = query.fromIso
    ? hasPublicPartyStatementItemsBefore(query.fromIso)
    : Promise.resolve(false);
  const confirmedTelegramSummaryIds = await confirmedTelegramSummaryIdsPromise;
  const [telegramItems, partyItems, hasTelegramItemsBefore, hasPartyItemsBefore] =
    await Promise.all([
      getPublicTelegramStatementItems({
        ...query,
        confirmedTelegramSummaryIds,
      }),
      partyItemsPromise,
      query.fromIso
        ? hasPublicTelegramStatementItemsBefore(
            query.fromIso,
            confirmedTelegramSummaryIds,
          )
        : Promise.resolve(false),
      hasPartyItemsBeforePromise,
    ]);

  return {
    hasMoreBefore: hasTelegramItemsBefore || hasPartyItemsBefore,
    items: mergePublicStatementFeedItems(telegramItems, partyItems, query.limit),
  };
}

function normalizePublicStatementFeedQuery(
  query: PublicStatementFeedQuery,
) {
  return {
    fromIso: query.fromIso,
    limit: query.limit ?? 100,
    toIso: query.toIso,
  };
}

function mergePublicStatementFeedItems(
  telegramItems: PublicStatementFeedItem[],
  partyItems: PublicStatementFeedItem[],
  limit: number,
) {
  return [...telegramItems, ...partyItems]
    .sort(compareStatementItemsNewestFirst)
    .slice(0, limit)
    .sort(compareStatementItemsOldestFirst);
}

function getPublicStatementFeedWindowCacheKey(
  query: Required<Pick<PublicStatementFeedQuery, "limit">> &
    Omit<PublicStatementFeedQuery, "limit">,
) {
  return [
    query.fromIso ?? "",
    query.toIso ?? "",
    String(query.limit),
  ].join(":");
}

function pruneExpiredPublicFeedWindowCache(now: number) {
  if (publicFeedWindowCache.size <= 24) {
    return;
  }

  for (const [cacheKey, entry] of publicFeedWindowCache) {
    if (entry.expiresAt <= now) {
      publicFeedWindowCache.delete(cacheKey);
    }
  }
}
