import "server-only";

import { classifyTelegramStatementMessage } from "@/lib/telegram-statements/classifier";
import type { TelegramChannelMessage } from "@/lib/telegram/channel-page";
import { getXStatementConfig, XStatementConfigError } from "./config";
import {
  addXStatementSourceResult,
  createXStatementScanRun,
  finishXStatementScanRun,
  getRequiredXStatementSupabaseClient,
  getXPostText,
  getXStatementSources,
  markXStatementSourceScanFinished,
  updateXStatementSourceIdentity,
  upsertXStatementPosts,
  upsertXStatementSummaryCandidates,
} from "./repository";
import {
  getXStatementExtractionErrorMessage,
  processXStatementSummary,
} from "./summary-extraction";
import type {
  XPost,
  XStatementCandidate,
  XStatementRunOptions,
  XStatementRunResult,
  XStatementSource,
  XStatementSourceResult,
  XUser,
} from "./types";
import { fetchXUserPosts } from "./x-api-tweets";
import { fetchXUserByUsername } from "./x-api-users";
import { XApiError } from "./x-api-client";

export { XApiError, XStatementConfigError };
export type { XStatementRunOptions, XStatementRunResult };

export async function runXStatementFeedScan(
  options: XStatementRunOptions = {},
): Promise<XStatementRunResult> {
  const config = getXStatementConfig();
  const supabase = getRequiredXStatementSupabaseClient();
  const dryRun = options.dryRun ?? false;
  const startTime = options.startTime ?? null;
  const runId = await createXStatementScanRun({
    dryRun,
    startTime,
    supabase,
  });
  const totals = createEmptyXStatementRunResult({
    dryRun,
    runId,
    startTime,
  });

  try {
    const sources = await getXStatementSources({
      source: options.source,
      supabase,
    });

    for (const source of sources) {
      const sourceResult = await runXStatementSource({
        bearerToken: config.bearerToken,
        dryRun,
        maxPagesPerSource:
          options.maxPagesPerSource ??
          (startTime
            ? config.backfillTimelinePagesPerSource
            : config.timelinePagesPerSource),
        postsPerSource: config.postsPerSource,
        source,
        startTime,
        supabase,
      });

      addXStatementSourceResult(totals, sourceResult);
    }

    await finishXStatementScanRun({
      runId,
      status: "succeeded",
      supabase,
      totals,
    });

    return totals;
  } catch (error) {
    await finishXStatementScanRun({
      errorMessage: getXStatementExtractionErrorMessage(error),
      runId,
      status: "failed",
      supabase,
      totals,
    });

    throw error;
  }
}

async function runXStatementSource({
  bearerToken,
  dryRun,
  maxPagesPerSource,
  postsPerSource,
  source,
  startTime,
  supabase,
}: {
  bearerToken: string;
  dryRun: boolean;
  maxPagesPerSource: number;
  postsPerSource: number;
  source: XStatementSource;
  startTime: string | null;
  supabase: ReturnType<typeof getRequiredXStatementSupabaseClient>;
}): Promise<XStatementSourceResult> {
  const result = createEmptyXStatementSourceResult(source);

  try {
    const user = await resolveXSourceUser({ bearerToken, source, supabase, dryRun });
    const timeline = await fetchXUserPosts({
      bearerToken,
      maxPages: maxPagesPerSource,
      maxResults: postsPerSource,
      sinceId: startTime ? undefined : source.lastScannedPostId ?? undefined,
      startTime: startTime ?? undefined,
      userId: user.id,
    });
    const timelinePosts = timeline.data ?? [];
    const posts = filterCollectibleXPosts(timelinePosts, startTime);
    const classifiedPostIds = new Set(
      posts.flatMap((post) =>
        classifyXStatementPost(post, source) ? [post.id] : [],
      ),
    );

    result.postsSeen = timelinePosts.length;
    result.candidateMatches = classifiedPostIds.size;

    if (dryRun) {
      return result;
    }

    const postRecords = await upsertXStatementPosts({
      dryRun,
      posts,
      source,
      supabase,
      xUserId: user.id,
    });
    const candidates = posts.flatMap((post): XStatementCandidate[] => {
      if (!classifiedPostIds.has(post.id)) {
        return [];
      }

      const record = postRecords.get(post.id);
      const classified = classifyXStatementPost(post, source);

      if (!record || !classified) {
        return [];
      }

      return [
        {
          detectionReason: classified.detectionReason,
          documentType: classified.documentType,
          post: record,
        },
      ];
    });
    const summaries = await upsertXStatementSummaryCandidates({
      candidates,
      dryRun,
      organizationName: source.organizationName,
      sourceKey: source.sourceKey,
      supabase,
    });

    result.postsWritten = postRecords.size;
    result.candidatesCreated = summaries.filter(
      (summary) => summary.status === "pending",
    ).length;

    for (const summary of summaries) {
      if (summary.status !== "pending") {
        continue;
      }

      const status = await processXStatementSummary(summary);

      if (status === "extracted") {
        result.extracted += 1;
      } else if (status === "skipped") {
        result.skipped += 1;
      } else if (status === "failed") {
        result.failed += 1;
      }
    }

    await markXStatementSourceScanFinished({
      cursor: chooseLatestXPostCursor(timelinePosts),
      sourceKey: source.sourceKey,
      supabase,
    });

    return result;
  } catch (error) {
    result.failed += 1;

    if (!dryRun) {
      await markXStatementSourceScanFinished({
        errorMessage: getXStatementExtractionErrorMessage(error),
        sourceKey: source.sourceKey,
        supabase,
      });
    }

    return result;
  }
}

async function resolveXSourceUser({
  bearerToken,
  dryRun,
  source,
  supabase,
}: {
  bearerToken: string;
  dryRun: boolean;
  source: XStatementSource;
  supabase: ReturnType<typeof getRequiredXStatementSupabaseClient>;
}): Promise<XUser> {
  if (source.xUserId) {
    return {
      id: source.xUserId,
      name: source.organizationName,
      profile_image_url: source.profileImageUrl ?? undefined,
      username: source.username,
    };
  }

  const response = await fetchXUserByUsername({
    bearerToken,
    username: source.username,
  });

  if (!response.data) {
    throw new Error(`X user not found: ${source.username}`);
  }

  if (!dryRun) {
    await updateXStatementSourceIdentity({
      sourceKey: source.sourceKey,
      supabase,
      user: response.data,
    });
  }

  return response.data;
}

function classifyXStatementPost(post: XPost, source: XStatementSource) {
  const text = getXPostText(post);

  if (!text) {
    return null;
  }

  const candidate = classifyTelegramStatementMessage({
    createdAt: post.created_at ?? null,
    imageUrls: [],
    messageId: 0,
    rawHtml: "",
    sourceUrl: `https://x.com/${source.username}/status/${post.id}`,
    text,
  } satisfies TelegramChannelMessage);

  if (!candidate) {
    return null;
  }

  return {
    detectionReason: candidate.detectionReason,
    documentType: candidate.documentType,
  };
}

function filterCollectibleXPosts(posts: XPost[], startTime: string | null) {
  return posts
    .filter((post) => getXPostText(post).trim())
    .filter((post) => !post.referenced_tweets?.length)
    .filter((post) => {
      if (!startTime || !post.created_at) {
        return true;
      }

      return post.created_at >= startTime;
    });
}

function chooseLatestXPostCursor(posts: XPost[]) {
  const latestPost = posts
    .filter((post) => post.created_at)
    .sort(compareXPostsByDateDesc)[0];

  return toPostCursor(latestPost);
}

function toPostCursor(post: XPost | undefined) {
  if (!post) {
    return null;
  }

  return {
    postedAt: post.created_at ?? null,
    xPostId: post.id,
  };
}

function compareXPostsByDateDesc(first: XPost, second: XPost) {
  const firstTime = first.created_at ? Date.parse(first.created_at) : 0;
  const secondTime = second.created_at ? Date.parse(second.created_at) : 0;

  if (firstTime !== secondTime) {
    return secondTime - firstTime;
  }

  return second.id.localeCompare(first.id);
}

function createEmptyXStatementRunResult({
  dryRun,
  runId,
  startTime,
}: {
  dryRun: boolean;
  runId: string | null;
  startTime: string | null;
}): XStatementRunResult {
  return {
    candidatesCreated: 0,
    candidateMatches: 0,
    dryRun,
    extracted: 0,
    failed: 0,
    postsSeen: 0,
    postsWritten: 0,
    results: [],
    runId,
    skipped: 0,
    sourcesScanned: 0,
    startTime,
  };
}

function createEmptyXStatementSourceResult(
  source: XStatementSource,
): XStatementSourceResult {
  return {
    candidatesCreated: 0,
    candidateMatches: 0,
    extracted: 0,
    failed: 0,
    organizationName: source.organizationName,
    postsSeen: 0,
    postsWritten: 0,
    skipped: 0,
    sourceKey: source.sourceKey,
    username: source.username,
  };
}
