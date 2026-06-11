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
import type { OpsSupabaseClient } from "./ops-types";
export type {
  DataSourceRow,
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
  ]);

  return {
    partyCounts,
    dataSources,
    dataSourceHealthCounts: getDataSourceHealthCounts(dataSources),
    recentPartyTopics,
    recentProblems,
    recentScanRuns,
    recentTopics,
    telegramCounts,
    webCounts,
    xCounts,
  };
}
