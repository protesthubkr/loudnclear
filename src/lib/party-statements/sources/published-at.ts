import { normalizeText, parseKoreanDateTime } from "../html";
import type {
  PartyStatementPublishedAtPrecision,
  PartyStatementPublishedAtTimeSource,
} from "../types";

export type PartyStatementPublishedAt = {
  publishedAt: string | null;
  publishedAtPrecision: PartyStatementPublishedAtPrecision;
  publishedAtTimeSource: PartyStatementPublishedAtTimeSource;
};

export function parsePartyPublishedAt(value: string): PartyStatementPublishedAt {
  const publishedAt = parseKoreanDateTime(value);

  if (!publishedAt) {
    return {
      publishedAt: null,
      publishedAtPrecision: "unknown",
      publishedAtTimeSource: "source",
    };
  }

  return {
    publishedAt,
    publishedAtPrecision: inferSourcePrecision(value),
    publishedAtTimeSource: "source",
  };
}

export function applyCollectedHour(
  publishedAt: string | null,
): PartyStatementPublishedAt {
  if (!publishedAt) {
    return {
      publishedAt: null,
      publishedAtPrecision: "unknown",
      publishedAtTimeSource: "collected",
    };
  }

  const publishedDateKey = getKoreanDateKey(new Date(publishedAt));
  const collectedHour = getKoreanHour(new Date());

  if (!publishedDateKey || !collectedHour) {
    return {
      publishedAt,
      publishedAtPrecision: "unknown",
      publishedAtTimeSource: "collected",
    };
  }

  const collectedHourDate = new Date(
    `${publishedDateKey}T${collectedHour}:00:00+09:00`,
  );

  if (Number.isNaN(collectedHourDate.getTime())) {
    return {
      publishedAt,
      publishedAtPrecision: "unknown",
      publishedAtTimeSource: "collected",
    };
  }

  return {
    publishedAt: collectedHourDate.toISOString(),
    publishedAtPrecision: "hour",
    publishedAtTimeSource: "collected",
  };
}

function inferSourcePrecision(
  value: string,
): PartyStatementPublishedAtPrecision {
  const normalized = normalizeText(value);

  if (/\d{1,2}:\d{2}:\d{2}/.test(normalized)) {
    return "second";
  }

  if (/\d{1,2}:\d{2}/.test(normalized)) {
    return "minute";
  }

  return "date";
}

function getKoreanDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function getKoreanHour(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);

  return parts.find((part) => part.type === "hour")?.value ?? null;
}
