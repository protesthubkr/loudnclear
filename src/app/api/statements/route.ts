import { NextRequest, NextResponse } from "next/server";
import { getPublicStatementFeedWindow } from "@/lib/telegram-statements/public-feed";
import {
  STATEMENT_FEED_WINDOW_DAYS,
  STATEMENT_FEED_WINDOW_ITEM_LIMIT,
  type PublicStatementFeedWindowResponse,
} from "@/lib/telegram-statements/public-feed-window";

export const runtime = "nodejs";
const STATEMENT_API_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_STATEMENT_WINDOW_MS = STATEMENT_FEED_WINDOW_DAYS * DAY_IN_MS;
const MAX_FUTURE_WINDOW_TO_MS = 2 * DAY_IN_MS;

export async function GET(request: NextRequest) {
  const parsedWindow = parseStatementWindow(request);

  if (!parsedWindow) {
    return NextResponse.json({ error: "Invalid window." }, { status: 400 });
  }

  const { hasMoreBefore, items } = await getPublicStatementFeedWindow({
    fromIso: parsedWindow.from,
    limit: STATEMENT_FEED_WINDOW_ITEM_LIMIT,
    toIso: parsedWindow.to,
  });

  return NextResponse.json(
    {
      hasMoreBefore,
      items,
      window: parsedWindow,
    } satisfies PublicStatementFeedWindowResponse,
    {
      headers: {
        "Cache-Control": STATEMENT_API_CACHE_CONTROL,
      },
    },
  );
}

function parseStatementWindow(request: NextRequest) {
  const from = parseIsoDate(request.nextUrl.searchParams.get("from"));
  const to = parseIsoDate(request.nextUrl.searchParams.get("to"));

  if (!from || !to) {
    return null;
  }

  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);

  if (
    fromTime >= toTime ||
    toTime - fromTime > MAX_STATEMENT_WINDOW_MS ||
    toTime > Date.now() + MAX_FUTURE_WINDOW_TO_MS
  ) {
    return null;
  }

  return { from, to };
}

function parseIsoDate(value: string | null) {
  if (!value) {
    return null;
  }

  const time = Date.parse(value);

  if (!Number.isFinite(time)) {
    return null;
  }

  return new Date(time).toISOString();
}
