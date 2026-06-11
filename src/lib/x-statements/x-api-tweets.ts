import "server-only";

import type { XTimelineResponse } from "./types";
import { TWEET_FIELDS, X_API_BASE_URL } from "./x-api-fields";
import { fetchX } from "./x-api-client";

export async function fetchXUserPosts({
  bearerToken,
  maxPages,
  maxResults,
  sinceId,
  startTime,
  userId,
}: {
  bearerToken: string;
  maxPages: number;
  maxResults: number;
  sinceId?: string;
  startTime?: string;
  userId: string;
}) {
  const mergedResponse: XTimelineResponse = {
    data: [],
  };
  let paginationToken: string | undefined;
  let pagesFetched = 0;

  do {
    const page = await fetchXUserPostsPage({
      bearerToken,
      maxResults,
      paginationToken,
      sinceId,
      startTime,
      userId,
    });

    mergedResponse.data?.push(...(page.data ?? []));
    mergedResponse.errors = [
      ...(mergedResponse.errors ?? []),
      ...(page.errors ?? []),
    ];
    mergedResponse.meta = page.meta;
    paginationToken = page.meta?.next_token;
    pagesFetched += 1;
  } while (paginationToken && pagesFetched < maxPages);

  return mergedResponse;
}

async function fetchXUserPostsPage({
  bearerToken,
  maxResults,
  paginationToken,
  sinceId,
  startTime,
  userId,
}: {
  bearerToken: string;
  maxResults: number;
  paginationToken?: string;
  sinceId?: string;
  startTime?: string;
  userId: string;
}) {
  const url = new URL(`${X_API_BASE_URL}/users/${userId}/tweets`);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("exclude", "replies,retweets");
  url.searchParams.set("tweet.fields", TWEET_FIELDS);

  if (sinceId) {
    url.searchParams.set("since_id", sinceId);
  } else if (startTime) {
    url.searchParams.set("start_time", startTime);
  }

  if (paginationToken) {
    url.searchParams.set("pagination_token", paginationToken);
  }

  return fetchX<XTimelineResponse>(url, bearerToken);
}
