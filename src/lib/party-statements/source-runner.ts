import "server-only";

import { fetchPartyStatementHtml } from "./html";
import {
  getRequiredPartyStatementSupabaseClient,
  markPartyStatementSourceScanFinished,
  upsertPartyStatementDocument,
  upsertPartyStatementSource,
  upsertPartyStatementSummaryCandidate,
} from "./repository";
import {
  getPartyStatementErrorMessage,
  processPartyStatementSummary,
} from "./summary-extraction";
import type {
  PartyStatementRunOutcome,
  PartyStatementRunSourceResult,
} from "./run-types";
import type {
  PartyStatementDocument,
  PartyStatementListItem,
  PartyStatementListUrlContext,
  PartyStatementSourceParser,
} from "./types";

export async function runPartyStatementSource({
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
  source: PartyStatementSourceParser;
}) {
  const supabase = dryRun ? null : getRequiredPartyStatementSupabaseClient();
  const result: PartyStatementRunSourceResult = {
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
      await upsertPartyStatementSource({ source, supabase });
    }

    const listUrls = getSourceListUrls(source, { cutoffIso, limit });
    const listPageResults = await Promise.allSettled(
      listUrls.map(async (listUrl) => {
        const listHtml = await fetchPartyStatementHtml({
          allowInsecureTls: source.allowInsecureTls,
          url: listUrl,
        });

        return source.parseList(listHtml, listUrl);
      }),
    );
    const listPageFailures = listPageResults.filter(isRejectedPromiseResult);
    const partialListErrorMessage = getPartialListErrorMessage({
      failures: listPageFailures,
      total: listUrls.length,
    });
    const parsedListItems = listPageResults
      .flatMap((listPageResult) =>
        listPageResult.status === "fulfilled" ? listPageResult.value : [],
      )
      .flat()
      .filter(dedupePartyListItem())
      .sort(comparePartyListItemsByDateDesc);

    if (parsedListItems.length === 0 && listPageFailures.length > 0) {
      throw listPageFailures[0].reason;
    }

    if (partialListErrorMessage) {
      result.failed += listPageFailures.length;
    }

    const listItems = parsedListItems
      .filter((listItem) => shouldIncludePartyListItem(listItem, cutoffIso))
      .slice(0, limit);
    result.documentsSeen = parsedListItems.length;
    result.outsideWindow = parsedListItems.length - listItems.length;

    for (const listItem of listItems) {
      const detailHtml = await fetchPartyStatementHtml({
        allowInsecureTls: source.allowInsecureTls,
        url: listItem.sourceUrl,
      });
      const document = source.parseDetail(detailHtml, listItem);

      result.detailsFetched += 1;

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
        result.outcomes.push(toPartyStatementRunOutcome(document, "seen"));
        continue;
      }

      const documentId = await upsertPartyStatementDocument({
        document,
        supabase,
      });
      const summary = await upsertPartyStatementSummaryCandidate({
        document,
        documentId,
        supabase,
      });

      result.stored += 1;

      if (summary.status === "extracted" && !force) {
        result.outcomes.push(
          toPartyStatementRunOutcome(document, "already_extracted"),
        );
        continue;
      }

      const extractionStatus = await processPartyStatementSummary(summary, {
        force,
      });
      result.outcomes.push(toPartyStatementRunOutcome(document, extractionStatus));

      if (extractionStatus === "extracted") {
        result.extracted += 1;
      } else if (extractionStatus === "skipped") {
        result.skipped += 1;
      } else if (extractionStatus === "failed") {
        result.failed += 1;
      }
    }

    if (supabase) {
      await markPartyStatementSourceScanFinished({
        errorMessage: partialListErrorMessage ?? undefined,
        sourceKey: source.sourceKey,
        supabase,
      });
    }
  } catch (error) {
    result.failed += 1;

    if (supabase) {
      await markPartyStatementSourceScanFinished({
        errorMessage: getPartyStatementErrorMessage(error),
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

function isRejectedPromiseResult<T>(
  result: PromiseSettledResult<T>,
): result is PromiseRejectedResult {
  return result.status === "rejected";
}

function getPartialListErrorMessage({
  failures,
  total,
}: {
  failures: PromiseRejectedResult[];
  total: number;
}) {
  if (failures.length === 0 || failures.length === total) {
    return null;
  }

  return `partial_list_fetch_failed:${failures.length}/${total}:${getPartyStatementErrorMessage(
    failures[0].reason,
  )}`;
}

function getSourceListUrls(
  source: PartyStatementSourceParser,
  context: PartyStatementListUrlContext,
) {
  const listUrls = source.buildListUrls?.(context) ??
    (source.listUrls?.length ? source.listUrls : [source.listUrl]);

  return Array.from(new Set(listUrls));
}

function dedupePartyListItem() {
  const seenKeys = new Set<string>();

  return (listItem: PartyStatementListItem) => {
    const key = `${listItem.sourceKey}:${listItem.externalId}`;

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  };
}

function comparePartyListItemsByDateDesc(
  left: PartyStatementDocument | { publishedAt: string | null },
  right: PartyStatementDocument | { publishedAt: string | null },
) {
  const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
  const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;

  return rightTime - leftTime;
}

function shouldIncludePartyListItem(
  listItem: { publishedAt: string | null },
  cutoffIso: string | null,
) {
  if (!cutoffIso || !listItem.publishedAt) {
    return true;
  }

  return listItem.publishedAt >= cutoffIso;
}

function toPartyStatementRunOutcome(
  document: PartyStatementDocument,
  status: PartyStatementRunOutcome["status"],
): PartyStatementRunOutcome {
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
