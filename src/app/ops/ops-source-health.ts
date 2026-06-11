import type {
  BaseDataSourceRow,
  DataSourceHealthCounts,
  DataSourceRow,
  SourceHealthStatus,
  SourceSummaryCounts,
} from "./ops-types";
import { getEmptySourceCounts } from "./ops-source-summary-counts";

const SOURCE_HEALTH_LOOKBACK_DAYS = 7;

const SOURCE_STALE_HOURS: Record<DataSourceRow["source_type"], number> = {
  party: 6,
  telegram: 3,
  web: 3,
  x: 24,
};

export function attachSourceHealth(
  source: BaseDataSourceRow,
  counts = getEmptySourceCounts(),
  now: Date,
): DataSourceRow {
  const health = getSourceHealth(source, counts, now);

  return {
    ...source,
    health_reason: health.reason,
    health_status: health.status,
    recent_extracted_count: counts.extracted,
    recent_failed_count: counts.failed,
    recent_pending_count: counts.pending,
    recent_skipped_count: counts.skipped,
  };
}

export function compareDataSources(first: DataSourceRow, second: DataSourceRow) {
  const healthCompare =
    getHealthSortOrder(first.health_status) -
    getHealthSortOrder(second.health_status);

  if (healthCompare !== 0) {
    return healthCompare;
  }

  const typeCompare = first.source_type.localeCompare(second.source_type);

  if (typeCompare !== 0) {
    return typeCompare;
  }

  return first.organization_name.localeCompare(second.organization_name, "ko");
}

export function getDataSourceHealthCounts(
  sources: DataSourceRow[],
): DataSourceHealthCounts {
  return sources.reduce<DataSourceHealthCounts>(
    (counts, source) => {
      counts[source.health_status] += 1;
      return counts;
    },
    {
      inactive: 0,
      needs_attention: 0,
      ok: 0,
      unknown: 0,
    },
  );
}

function getSourceHealth(
  source: BaseDataSourceRow,
  counts: SourceSummaryCounts,
  now: Date,
): { reason: string; status: SourceHealthStatus } {
  if (!source.enabled || source.status !== "enabled") {
    return {
      reason: `현재 ${source.status} 상태입니다.`,
      status: "inactive",
    };
  }

  if (source.last_error?.trim()) {
    return {
      reason: source.last_error.trim(),
      status: "needs_attention",
    };
  }

  if (counts.failed > 0) {
    return {
      reason: `최근 ${SOURCE_HEALTH_LOOKBACK_DAYS}일 failed ${counts.failed.toLocaleString(
        "ko-KR",
      )}건`,
      status: "needs_attention",
    };
  }

  if (!source.last_scanned_at) {
    return {
      reason: "아직 수집 기록이 없습니다.",
      status: "unknown",
    };
  }

  const lastScannedAt = new Date(source.last_scanned_at);
  const elapsedHours =
    (now.getTime() - lastScannedAt.getTime()) / (60 * 60 * 1000);

  if (
    Number.isFinite(elapsedHours) &&
    elapsedHours > SOURCE_STALE_HOURS[source.source_type]
  ) {
    return {
      reason: `마지막 수집이 ${formatElapsedHours(elapsedHours)} 전입니다.`,
      status: "needs_attention",
    };
  }

  if (counts.extracted > 0) {
    return {
      reason: `최근 ${SOURCE_HEALTH_LOOKBACK_DAYS}일 extracted ${counts.extracted.toLocaleString(
        "ko-KR",
      )}건`,
      status: "ok",
    };
  }

  return {
    reason: "최근 수집 실행이 정상 범위에 있습니다.",
    status: "ok",
  };
}

function getHealthSortOrder(status: SourceHealthStatus) {
  switch (status) {
    case "needs_attention":
      return 0;
    case "unknown":
      return 1;
    case "ok":
      return 2;
    case "inactive":
      return 3;
  }
}

function formatElapsedHours(hours: number) {
  if (hours < 24) {
    return `${Math.floor(hours)}시간`;
  }

  return `${Math.floor(hours / 24)}일`;
}
