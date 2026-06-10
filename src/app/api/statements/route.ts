import { NextRequest, NextResponse } from "next/server";
import {
  getPublicStatementFeedItems,
  hasPublicStatementFeedItemsBefore,
} from "@/lib/telegram-statements/public-feed";
import {
  STATEMENT_FEED_WINDOW_ITEM_LIMIT,
  type PublicStatementFeedWindowResponse,
} from "@/lib/telegram-statements/public-feed-window";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parsedWindow = parseStatementWindow(request);

  if (!parsedWindow) {
    return NextResponse.json({ error: "Invalid window." }, { status: 400 });
  }

  const items = await getPublicStatementFeedItems({
    fromIso: parsedWindow.from,
    limit: STATEMENT_FEED_WINDOW_ITEM_LIMIT,
    toIso: parsedWindow.to,
  });
  const hasMoreBefore = await hasPublicStatementFeedItemsBefore(
    parsedWindow.from,
  );

  return NextResponse.json({
    hasMoreBefore,
    items,
    window: parsedWindow,
  } satisfies PublicStatementFeedWindowResponse);
}

function parseStatementWindow(request: NextRequest) {
  const from = parseIsoDate(request.nextUrl.searchParams.get("from"));
  const to = parseIsoDate(request.nextUrl.searchParams.get("to"));

  if (!from || !to || Date.parse(from) >= Date.parse(to)) {
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
