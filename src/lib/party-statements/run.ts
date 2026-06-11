import "server-only";

import {
  getPartyStatementCutoffIso,
  getPartyStatementRunLimit,
} from "./run-config";
import {
  getPartyStatementSummaryById,
  getRequiredPartyStatementSupabaseClient,
} from "./repository";
import { runPartyStatementSource } from "./source-runner";
import { processPartyStatementSummary } from "./summary-extraction";
import { getPartyStatementSources } from "./sources";
import type { PartyStatementRunOptions } from "./types";
import type {
  PartyStatementExtractionStatus,
  PartyStatementRunOutcome,
  PartyStatementRunResult,
  PartyStatementRunSourceResult,
} from "./run-types";

export type {
  PartyStatementExtractionStatus,
  PartyStatementRunOutcome,
  PartyStatementRunResult,
  PartyStatementRunSourceResult,
} from "./run-types";

export async function runPartyStatementIngest(
  options: PartyStatementRunOptions = {},
): Promise<PartyStatementRunResult> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const limit = getPartyStatementRunLimit(options.limit);
  const cutoffIso = getPartyStatementCutoffIso(options.windowHours);

  if (options.summaryId) {
    return runPartyStatementSummary({
      cutoffIso,
      dryRun,
      force,
      summaryId: options.summaryId,
    });
  }

  const sources = getPartyStatementSources(options.source);
  const result: PartyStatementRunResult = {
    cutoffIso,
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
    const sourceResult = await runPartyStatementSource({
      dryRun,
      cutoffIso,
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

async function runPartyStatementSummary({
  cutoffIso,
  dryRun,
  force,
  summaryId,
}: {
  cutoffIso: string | null;
  dryRun: boolean;
  force: boolean;
  summaryId: string;
}): Promise<PartyStatementRunResult> {
  const supabase = getRequiredPartyStatementSupabaseClient();
  const summary = await getPartyStatementSummaryById({ summaryId, supabase });
  const sourceResult: PartyStatementRunSourceResult = {
    detailsFetched: 0,
    documentsSeen: 1,
    extracted: 0,
    failed: 0,
    outcomes: [],
    outsideWindow: 0,
    skipped: 0,
    sourceKey: summary.source_key,
    stored: 0,
  };

  if (dryRun) {
    sourceResult.outcomes.push(toSummaryOutcome(summary, "seen"));
  } else if (summary.status === "extracted" && !force) {
    sourceResult.outcomes.push(toSummaryOutcome(summary, "already_extracted"));
  } else {
    const extractionStatus = await processPartyStatementSummary(summary, {
      force,
    });
    sourceResult.outcomes.push(toSummaryOutcome(summary, extractionStatus));
    incrementSourceResult(sourceResult, extractionStatus);
  }

  return {
    cutoffIso,
    dryRun,
    extracted: sourceResult.extracted,
    failed: sourceResult.failed,
    force,
    outsideWindow: sourceResult.outsideWindow,
    results: [sourceResult],
    skipped: sourceResult.skipped,
    sourcesSeen: 1,
    stored: sourceResult.stored,
  };
}

function incrementSourceResult(
  result: PartyStatementRunSourceResult,
  status: PartyStatementExtractionStatus,
) {
  if (status === "extracted") {
    result.extracted += 1;
  } else if (status === "skipped") {
    result.skipped += 1;
  } else if (status === "failed") {
    result.failed += 1;
  }
}

function toSummaryOutcome(
  summary: Awaited<ReturnType<typeof getPartyStatementSummaryById>>,
  status: PartyStatementRunOutcome["status"],
): PartyStatementRunOutcome {
  return {
    documentType: summary.document_type,
    organizationName: summary.organization_name,
    sourceKey: summary.source_key,
    sourceUrl: summary.source_url,
    status,
    title: summary.title,
  };
}
