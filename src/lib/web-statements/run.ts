import "server-only";

import { fetchPartyStatementHtml } from "@/lib/party-statements/html";
import {
  getRequiredWebStatementSupabaseClient,
  markWebStatementSourceScanFinished,
  upsertWebStatementDocument,
  upsertWebStatementSource,
  upsertWebStatementSummaryCandidate,
} from "./repository";
import {
  getWebStatementExtractionErrorMessage,
  processWebStatementSummary,
} from "./summary-extraction";
import { getWebStatementSources } from "./sources";
import type {
  WebStatementDocument,
  WebStatementListItem,
  WebStatementRunOptions,
  WebStatementRunOutcome,
  WebStatementRunResult,
  WebStatementRunSourceResult,
  WebStatementSourceKey,
  WebStatementSourceParser,
} from "./types";

const DEFAULT_WEB_STATEMENT_LIMIT = 50;
const DEFAULT_WEB_STATEMENT_WINDOW_HOURS = 168;

export type { WebStatementRunOptions, WebStatementRunResult };

export async function runWebStatementIngest(
  options: WebStatementRunOptions = {},
): Promise<WebStatementRunResult> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const limit = options.limit ?? DEFAULT_WEB_STATEMENT_LIMIT;
  const windowHours =
    options.windowHours ?? getDefaultWebStatementWindowHours();
  const cutoffIso = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();
  const sources = getWebStatementSources(options.source);
  const result: WebStatementRunResult = {
    dryRun,
    extracted: 0,
    failed: 0,
    force,
    outsideWindow: 0,
    results: [],
    skipped: 0,
    sourcesSeen: sources.length,
    stored: 0,
  };

  for (const source of sources) {
    const sourceResult = await runWebStatementSource({
      cutoffIso,
      dryRun,
      force,
      limit,
      source,
    });

    result.results.push(sourceResult);
    result.extracted += sourceResult.extracted;
    result.failed += sourceResult.failed;
    result.outsideWindow += sourceResult.outsideWindow;
    result.skipped += sourceResult.skipped;
    result.stored += sourceResult.stored;
  }

  return result;
}

async function runWebStatementSource({
  cutoffIso,
  dryRun,
  force,
  limit,
  source,
}: {
  cutoffIso: string | null;
  dryRun: boolean;
  force: boolean;
  limit: number;
  source: WebStatementSourceParser;
}) {
  const supabase = dryRun ? null : getRequiredWebStatementSupabaseClient();
  const result: WebStatementRunSourceResult = {
    candidatesCreated: 0,
    detailsFetched: 0,
    documentsSeen: 0,
    extracted: 0,
    failed: 0,
    outcomes: [],
    outsideWindow: 0,
    skipped: 0,
    sourceKey: source.sourceKey,
    stored: 0,
  };

  try {
    if (supabase) {
      await upsertWebStatementSource({ source, supabase });
    }

    const listXml = await fetchPartyStatementHtml({
      headers: source.requestHeaders,
      url: source.listUrl,
    });
    const parsedListItems = source
      .parseList(listXml)
      .filter(dedupeWebListItem())
      .sort(compareWebListItemsByDateDesc);
    const windowedListItems = parsedListItems.filter((listItem) =>
      shouldIncludeWebListItem(listItem, cutoffIso),
    );
    const listItems = windowedListItems.slice(0, limit);

    result.documentsSeen = parsedListItems.length;
    result.outsideWindow = parsedListItems.length - windowedListItems.length;

    for (const listItem of listItems) {
      const shouldFetchDetail = source.shouldFetchDetail?.(listItem) ?? true;
      const detailHtml = shouldFetchDetail
        ? await fetchPartyStatementHtml({
            headers: source.requestHeaders,
            url: listItem.sourceUrl,
          })
        : "";
      const document = source.parseDetail(detailHtml, listItem);

      if (shouldFetchDetail) {
        result.detailsFetched += 1;
      }

      if (!document) {
        result.skipped += 1;
        result.outcomes.push({
          organizationName: source.organizationName,
          sourceKey: source.sourceKey,
          sourceUrl: listItem.sourceUrl,
          status: "skipped",
          title: listItem.title,
        });
        continue;
      }

      if (dryRun || !supabase) {
        result.outcomes.push(toWebStatementRunOutcome(document, "seen"));
        continue;
      }

      const documentId = await upsertWebStatementDocument({
        document,
        supabase,
      });
      const summary = await upsertWebStatementSummaryCandidate({
        document,
        documentId,
        supabase,
      });

      result.stored += 1;

      if (summary.status === "pending") {
        result.candidatesCreated += 1;
      }

      const extractionStatus = await processWebStatementSummary(summary, {
        force,
      });
      result.outcomes.push(toWebStatementRunOutcome(document, extractionStatus));

      if (extractionStatus === "extracted") {
        result.extracted += 1;
      } else if (extractionStatus === "skipped") {
        result.skipped += 1;
      } else if (extractionStatus === "failed") {
        result.failed += 1;
      }
    }

    if (supabase) {
      await markWebStatementSourceScanFinished({
        sourceKey: source.sourceKey,
        supabase,
      });
    }
  } catch (error) {
    result.failed += 1;

    if (supabase) {
      await markWebStatementSourceScanFinished({
        errorMessage: getWebStatementExtractionErrorMessage(error),
        sourceKey: source.sourceKey,
        supabase,
      });
    }

    result.outcomes.push({
      organizationName: source.organizationName,
      sourceKey: source.sourceKey,
      status: "failed",
    });
  }

  return result;
}

function dedupeWebListItem() {
  const seenKeys = new Set<string>();

  return (listItem: WebStatementListItem) => {
    const key = `${listItem.sourceKey}:${listItem.externalId}`;

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  };
}

function compareWebListItemsByDateDesc(
  left: { publishedAt: string | null },
  right: { publishedAt: string | null },
) {
  const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
  const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;

  return rightTime - leftTime;
}

function shouldIncludeWebListItem(
  listItem: { publishedAt: string | null },
  cutoffIso: string | null,
) {
  if (!cutoffIso || !listItem.publishedAt) {
    return true;
  }

  return listItem.publishedAt >= cutoffIso;
}

function getDefaultWebStatementWindowHours() {
  const value = process.env.WEB_STATEMENT_INGEST_WINDOW_HOURS;

  if (!value) {
    return DEFAULT_WEB_STATEMENT_WINDOW_HOURS;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_WEB_STATEMENT_WINDOW_HOURS;
  }

  return Math.min(Math.max(parsed, 1), 744);
}

function toWebStatementRunOutcome(
  document: WebStatementDocument,
  status: WebStatementRunOutcome["status"],
): WebStatementRunOutcome {
  return {
    documentType: document.documentType,
    externalId: document.externalId,
    organizationName: document.organizationName,
    sourceKey: document.sourceKey,
    sourceUrl: document.sourceUrl,
    status,
    title: document.title,
  };
}

export function isWebStatementSourceKey(
  value: string,
): value is WebStatementSourceKey {
  return (
    value === "climateall" ||
    value === "climatestrikekr" ||
    value === "equalact" ||
    value === "kfem" ||
    value === "kwau38" ||
    value === "rainbowactionkr"
  );
}
