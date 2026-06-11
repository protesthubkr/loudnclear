import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";
import type {
  XPost,
  XStatementCandidate,
  XStatementPostRecord,
  XStatementRunResult,
  XStatementSource,
  XStatementSourceResult,
  XUser,
} from "./types";

export type XStatementSummaryRow = {
  attempt_count: number;
  document_type: TelegramStatementDocumentType;
  id: string;
  organization_name: string;
  post_id: string;
  posted_at: string | null;
  source_key: string;
  source_url: string;
  status: string;
  x_post_id: string;
};

export function getRequiredXStatementSupabaseClient() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Missing Supabase admin configuration.");
  }

  return supabase;
}

export async function createXStatementScanRun({
  dryRun,
  startTime,
  supabase,
}: {
  dryRun: boolean;
  startTime: string | null;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("x_statement_scan_runs")
    .insert({
      metadata: {
        dryRun,
        source: "x_statement_feed",
        startTime,
      },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string } | null)?.id ?? null;
}

export async function finishXStatementScanRun({
  errorMessage,
  runId,
  status,
  supabase,
  totals,
}: {
  errorMessage?: string;
  runId: string | null;
  status: "failed" | "succeeded";
  supabase: SupabaseClient;
  totals: XStatementRunResult;
}) {
  if (!runId) {
    return;
  }

  const { error } = await supabase
    .from("x_statement_scan_runs")
    .update({
      candidates_created: totals.candidatesCreated,
      error_message: errorMessage ?? null,
      extracted: totals.extracted,
      failed: totals.failed,
      finished_at: new Date().toISOString(),
      posts_seen: totals.postsSeen,
      posts_written: totals.postsWritten,
      skipped: totals.skipped,
      sources_seen: totals.sourcesScanned,
      status,
    })
    .eq("id", runId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getXStatementSources({
  source,
  supabase,
}: {
  source?: string;
  supabase: SupabaseClient;
}) {
  let query = supabase
    .from("x_statement_sources")
    .select(
      [
        "source_key",
        "username",
        "x_user_id",
        "organization_name",
        "source_url",
        "profile_image_url",
        "enabled",
        "last_scanned_post_id",
        "last_scanned_post_at",
        "last_scanned_at",
        "last_error",
      ].join(","),
    )
    .eq("enabled", true)
    .order("source_key", { ascending: true });

  if (source) {
    query = query.or(`source_key.eq.${source},username.eq.${source}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as Array<{
    enabled: boolean;
    last_error: string | null;
    last_scanned_at: string | null;
    last_scanned_post_at: string | null;
    last_scanned_post_id: string | null;
    organization_name: string;
    profile_image_url: string | null;
    source_key: string;
    source_url: string;
    username: string;
    x_user_id: string | null;
  }> | null) ?? []).map((row): XStatementSource => ({
    enabled: row.enabled,
    lastError: row.last_error,
    lastScannedAt: row.last_scanned_at,
    lastScannedPostAt: row.last_scanned_post_at,
    lastScannedPostId: row.last_scanned_post_id,
    organizationName: row.organization_name,
    profileImageUrl: row.profile_image_url,
    sourceKey: row.source_key,
    sourceUrl: row.source_url,
    username: row.username,
    xUserId: row.x_user_id,
  }));
}

export async function updateXStatementSourceIdentity({
  sourceKey,
  supabase,
  user,
}: {
  sourceKey: string;
  supabase: SupabaseClient;
  user: XUser;
}) {
  const { error } = await supabase
    .from("x_statement_sources")
    .update({
      last_error: null,
      profile_image_url: user.profile_image_url ?? null,
      updated_at: new Date().toISOString(),
      username: user.username,
      x_user_id: user.id,
    })
    .eq("source_key", sourceKey);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markXStatementSourceScanFinished({
  cursor,
  errorMessage,
  sourceKey,
  supabase,
}: {
  cursor?: {
    postedAt: string | null;
    xPostId: string;
  } | null;
  errorMessage?: string;
  sourceKey: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    last_error: errorMessage ?? null,
    last_scanned_at: now,
    updated_at: now,
  };

  if (cursor) {
    update.last_scanned_post_at = cursor.postedAt;
    update.last_scanned_post_id = cursor.xPostId;
  }

  const { error } = await supabase
    .from("x_statement_sources")
    .update(update)
    .eq("source_key", sourceKey);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertXStatementPosts({
  dryRun,
  posts,
  source,
  supabase,
  xUserId,
}: {
  dryRun: boolean;
  posts: XPost[];
  source: XStatementSource;
  supabase: SupabaseClient;
  xUserId: string;
}) {
  if (posts.length === 0 || dryRun) {
    return new Map<string, XStatementPostRecord>();
  }

  const now = new Date().toISOString();
  const rows = posts.map((post) => ({
    author_name: source.organizationName,
    author_username: source.username,
    last_seen_at: now,
    posted_at: normalizePostedAt(post.created_at),
    raw_payload: {
      post,
    },
    source_key: source.sourceKey,
    source_url: createXPostUrl(source.username, post.id),
    text_snapshot: getXPostText(post),
    x_post_id: post.id,
    x_user_id: xUserId,
  }));

  const { error } = await supabase
    .from("x_statement_posts")
    .upsert(rows, {
      onConflict: "source_key,x_post_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  return getXStatementPostsByPostIds({
    postIds: posts.map((post) => post.id),
    sourceKey: source.sourceKey,
    supabase,
  });
}

export async function upsertXStatementSummaryCandidates({
  candidates,
  dryRun,
  organizationName,
  sourceKey,
  supabase,
}: {
  candidates: XStatementCandidate[];
  dryRun: boolean;
  organizationName: string;
  sourceKey: string;
  supabase: SupabaseClient;
}) {
  if (candidates.length === 0 || dryRun) {
    return [] as XStatementSummaryRow[];
  }

  const now = new Date().toISOString();
  const rows = candidates.map((candidate) => ({
    detection_reason: candidate.detectionReason,
    document_type: candidate.documentType,
    organization_name: organizationName,
    post_id: candidate.post.id,
    posted_at: candidate.post.postedAt,
    source_key: sourceKey,
    source_url: candidate.post.sourceUrl,
    status: "pending",
    updated_at: now,
    x_post_id: candidate.post.xPostId,
  }));

  const { error } = await supabase
    .from("x_statement_summaries")
    .upsert(rows, {
      ignoreDuplicates: true,
      onConflict: "source_key,x_post_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  return getXStatementSummariesByPostIds({
    postIds: candidates.map((candidate) => candidate.post.xPostId),
    sourceKey,
    supabase,
  });
}

export async function getXStatementPostText({
  postId,
  supabase,
}: {
  postId: string;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from("x_statement_posts")
    .select("id,text_snapshot")
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string; text_snapshot: string | null } | null;
}

export async function markXStatementExtractionAttemptStarted({
  attemptCount,
  summaryId,
  supabase,
}: {
  attemptCount: number;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("x_statement_summaries")
    .update({
      attempt_count: attemptCount + 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message);
  }
}

export async function markXStatementSummaryExtracted({
  confidence,
  coreSentence,
  coreSentenceEnd,
  coreSentenceStart,
  documentType,
  model,
  promptVersion,
  reason,
  summaryId,
  supabase,
}: {
  confidence: number;
  coreSentence: string;
  coreSentenceEnd: number;
  coreSentenceStart: number;
  documentType: TelegramStatementDocumentType;
  model: string;
  promptVersion: string;
  reason: string;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("x_statement_summaries")
    .update({
      core_sentence: coreSentence,
      core_sentence_end: coreSentenceEnd,
      core_sentence_start: coreSentenceStart,
      document_type: documentType,
      extracted_at: now,
      extraction_confidence: confidence,
      extraction_reason: reason,
      last_error: null,
      model,
      prompt_version: promptVersion,
      status: "extracted",
      updated_at: now,
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markXStatementSummarySkipped({
  errorMessage,
  model,
  promptVersion,
  summaryId,
  supabase,
}: {
  errorMessage: string;
  model?: string;
  promptVersion?: string;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("x_statement_summaries")
    .update({
      extracted_at: now,
      last_error: errorMessage,
      model: model ?? null,
      prompt_version: promptVersion ?? null,
      status: "skipped",
      updated_at: now,
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markXStatementSummaryFailed({
  errorMessage,
  summaryId,
  supabase,
}: {
  errorMessage: string;
  summaryId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("x_statement_summaries")
    .update({
      last_error: errorMessage,
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", summaryId);

  if (error) {
    throw new Error(error.message);
  }
}

export function addXStatementSourceResult(
  totals: XStatementRunResult,
  result: XStatementSourceResult,
) {
  totals.results.push(result);
  totals.candidatesCreated += result.candidatesCreated;
  totals.candidateMatches += result.candidateMatches;
  totals.extracted += result.extracted;
  totals.failed += result.failed;
  totals.postsSeen += result.postsSeen;
  totals.postsWritten += result.postsWritten;
  totals.skipped += result.skipped;
  totals.sourcesScanned += 1;
}

async function getXStatementPostsByPostIds({
  postIds,
  sourceKey,
  supabase,
}: {
  postIds: string[];
  sourceKey: string;
  supabase: SupabaseClient;
}) {
  if (postIds.length === 0) {
    return new Map<string, XStatementPostRecord>();
  }

  const { data, error } = await supabase
    .from("x_statement_posts")
    .select("id,source_key,x_post_id,source_url,posted_at,text_snapshot")
    .eq("source_key", sourceKey)
    .in("x_post_id", postIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    ((data as Array<{
      id: string;
      posted_at: string | null;
      source_key: string;
      source_url: string;
      text_snapshot: string | null;
      x_post_id: string;
    }> | null) ?? []).map((row) => [
      row.x_post_id,
      {
        id: row.id,
        postedAt: row.posted_at,
        sourceKey: row.source_key,
        sourceUrl: row.source_url,
        textSnapshot: row.text_snapshot ?? "",
        xPostId: row.x_post_id,
      },
    ]),
  );
}

async function getXStatementSummariesByPostIds({
  postIds,
  sourceKey,
  supabase,
}: {
  postIds: string[];
  sourceKey: string;
  supabase: SupabaseClient;
}) {
  if (postIds.length === 0) {
    return [] as XStatementSummaryRow[];
  }

  const { data, error } = await supabase
    .from("x_statement_summaries")
    .select(
      [
        "id",
        "post_id",
        "source_key",
        "x_post_id",
        "organization_name",
        "source_url",
        "posted_at",
        "document_type",
        "status",
        "attempt_count",
      ].join(","),
    )
    .eq("source_key", sourceKey)
    .in("x_post_id", postIds);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown as XStatementSummaryRow[] | null) ?? []).map(
    (row) => ({
      ...row,
      document_type: row.document_type as TelegramStatementDocumentType,
    }),
  );
}

export function getXPostText(post: XPost) {
  return (post.note_tweet?.text ?? post.text ?? "").trim();
}

export function createXPostUrl(username: string, postId: string) {
  return `https://x.com/${username}/status/${postId}`;
}

function normalizePostedAt(value: string | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return null;
  }

  return new Date(Date.parse(value)).toISOString();
}
