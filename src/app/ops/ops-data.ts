import "server-only";

import {
  getPartyCounts,
  getTelegramCounts,
  getWebCounts,
  getXCounts,
} from "./ops-counts";
export { formatDateTime, formatSourceType } from "./ops-format";
import {
  getRecentPartyTopics,
  getRecentProblems,
  getRecentScanRuns,
  getRecentTopics,
} from "./ops-recent";
import { getDataSourceHealthCounts, getDataSources } from "./ops-sources";
import {
  getDisplayDecisionReviewRows,
  getDisplayDecisionStatusCounts,
} from "./ops-display-decisions";
import type { OpsSupabaseClient } from "./ops-types";
export type {
  DataSourceRow,
  DisplayDecisionReviewRow,
  SourceHealthStatus,
} from "./ops-types";

export async function getOpsDashboardData(supabase: OpsSupabaseClient) {
  const [
    telegramCounts,
    partyCounts,
    webCounts,
    xCounts,
    recentScanRuns,
    dataSources,
    recentProblems,
    recentPartyTopics,
    recentTopics,
    displayDecisionCounts,
    displayDecisionReviewRows,
  ] = await Promise.all([
    getTelegramCounts(supabase),
    getPartyCounts(supabase),
    getWebCounts(supabase),
    getXCounts(supabase),
    getRecentScanRuns(supabase),
    getDataSources(supabase),
    getRecentProblems(supabase),
    getRecentPartyTopics(supabase),
    getRecentTopics(supabase),
    getDisplayDecisionStatusCounts(supabase),
    getDisplayDecisionReviewRows(supabase),
  ]);

  return {
    partyCounts,
    dataSources,
    dataSourceHealthCounts: getDataSourceHealthCounts(dataSources),
    displayDecisionCounts,
    displayDecisionReviewRows,
    recentPartyTopics,
    recentProblems,
    recentScanRuns,
    recentTopics,
    telegramCounts,
    webCounts,
    xCounts,
  };
}
