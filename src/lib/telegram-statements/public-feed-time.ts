import type { PublicStatementFeedItem } from "./public-feed-types";

export function compareStatementItemsNewestFirst(
  first: PublicStatementFeedItem,
  second: PublicStatementFeedItem,
) {
  return getStatementItemTime(second) - getStatementItemTime(first);
}

export function compareStatementItemsOldestFirst(
  first: PublicStatementFeedItem,
  second: PublicStatementFeedItem,
) {
  return getStatementItemTime(first) - getStatementItemTime(second);
}

export function resolvePartyStatementDisplayTime({
  publishedAt,
}: {
  collectedAt?: string | null;
  publishedAt: string | null;
  sourceKey?: string | null;
}) {
  if (!publishedAt) {
    return {
      isTimeUnknown: true,
      timestamp: null,
    };
  }

  if (!isDateOnlyStatementTimestamp(publishedAt)) {
    return {
      isTimeUnknown: false,
      timestamp: publishedAt,
    };
  }

  return {
    isTimeUnknown: true,
    timestamp: publishedAt,
  };
}

function getStatementItemTime(item: PublicStatementFeedItem) {
  if (!item.messageCreatedAt) {
    return 0;
  }

  if (item.isTimeUnknown) {
    const dateKey = getStatementItemDateKey(item.messageCreatedAt);

    return dateKey ? Date.parse(`${dateKey}T23:59:59.999+09:00`) : 0;
  }

  return new Date(item.messageCreatedAt).getTime();
}

function isDateOnlyStatementTimestamp(value: string | null) {
  return getStatementItemTimeKey(value) === "00:00";
}

function getStatementItemDateKey(value: string | null) {
  if (!value) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function getStatementItemTimeKey(value: string | null) {
  if (!value) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return hour && minute ? `${hour}:${minute}` : null;
}
