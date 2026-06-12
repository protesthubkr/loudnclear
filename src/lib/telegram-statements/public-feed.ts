import { revalidateTag, unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  compareStatementItemsNewestFirst,
  compareStatementItemsOldestFirst,
} from "./public-feed-time";
import {
  getPublicStatementFeedItemsFromRpc,
  hasPublicStatementFeedItemsBeforeFromRpc,
} from "./public-feed-rpc";
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
const PUBLIC_FEED_WINDOW_REVALIDATE_SECONDS = 60;
const PUBLIC_FEED_WINDOW_CACHE_TAG = "public-statement-feed-window";
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

  const promise = loadCachedPublicStatementFeedWindow(
    normalizedQuery.fromIso ?? "",
    normalizedQuery.toIso ?? "",
    normalizedQuery.limit,
  ).catch((error: unknown) => {
      if (publicFeedWindowCache.get(cacheKey)?.promise === promise) {
        publicFeedWindowCache.delete(cacheKey);
      }

      throw error;
    });

  publicFeedWindowCache.set(cacheKey, {
    expiresAt: now + PUBLIC_FEED_WINDOW_CACHE_TTL_MS,
    promise,
  });

  pruneExpiredPublicFeedWindowCache(now);

  return promise;
}

export function clearPublicStatementFeedWindowCache() {
  publicFeedWindowCache.clear();
  revalidateTag(PUBLIC_FEED_WINDOW_CACHE_TAG, "max");
}

const loadCachedPublicStatementFeedWindow = unstable_cache(
  async (fromIso: string, toIso: string, limit: number) =>
    loadPublicStatementFeedWindow({
      fromIso: fromIso || undefined,
      limit,
      toIso: toIso || undefined,
    }),
  ["public-statement-feed-window"],
  {
    revalidate: PUBLIC_FEED_WINDOW_REVALIDATE_SECONDS,
    tags: [PUBLIC_FEED_WINDOW_CACHE_TAG],
  },
);

async function loadPublicStatementFeedWindow(
  query: Required<Pick<PublicStatementFeedQuery, "limit">> &
    Omit<PublicStatementFeedQuery, "limit">,
): Promise<PublicStatementFeedWindowData> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      hasMoreBefore: false,
      items: [],
    };
  }

  const [items, hasMoreBefore] = await Promise.all([
    getPublicStatementFeedItemsFromRpc({ query, supabase }),
    hasPublicStatementFeedItemsBeforeFromRpc({
      beforeIso: query.fromIso,
      supabase,
    }),
  ]);

  return {
    hasMoreBefore,
    items: mergePublicStatementFeedItems(items, query.limit),
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
  items: PublicStatementFeedItem[],
  limit: number,
) {
  return items
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
