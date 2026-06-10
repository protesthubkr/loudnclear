import type { PublicStatementFeedItem } from "./public-feed-types";

export const STATEMENT_FEED_WINDOW_DAYS = 7;
export const STATEMENT_FEED_WINDOW_ITEM_LIMIT = 500;

export type StatementFeedWindow = {
  from: string;
  to: string;
};

export type PublicStatementFeedWindowResponse = {
  hasMoreBefore: boolean;
  items: PublicStatementFeedItem[];
  window: StatementFeedWindow;
};

export function getCurrentStatementFeedWindow(
  now = new Date(),
): StatementFeedWindow {
  const todayKey = getKoreanDateKey(now);
  const fromKey = addDaysToDateKey(todayKey, -(STATEMENT_FEED_WINDOW_DAYS - 1));
  const toKey = addDaysToDateKey(todayKey, 1);

  return {
    from: koreanDateKeyToIso(fromKey),
    to: koreanDateKeyToIso(toKey),
  };
}

export function getPreviousStatementFeedWindow(
  window: StatementFeedWindow,
): StatementFeedWindow {
  const toKey = getKoreanDateKey(new Date(window.from));
  const fromKey = addDaysToDateKey(toKey, -STATEMENT_FEED_WINDOW_DAYS);

  return {
    from: koreanDateKeyToIso(fromKey),
    to: koreanDateKeyToIso(toKey),
  };
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

  if (!year || !month || !day) {
    return "1970-01-01";
  }

  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);

  return getKoreanDateKey(date);
}

function koreanDateKeyToIso(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`).toISOString();
}
