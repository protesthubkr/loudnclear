import type { Metadata } from "next";
import {
  getPublicStatementFeedItems,
  hasPublicStatementFeedItemsBefore,
} from "@/lib/telegram-statements/public-feed";
import {
  getCurrentStatementFeedWindow,
  STATEMENT_FEED_WINDOW_ITEM_LIMIT,
} from "@/lib/telegram-statements/public-feed-window";
import { StatementFeedShell } from "./statement-feed-shell";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default async function HomePage() {
  const initialWindow = getCurrentStatementFeedWindow();
  const [items, hasMoreBefore] = await Promise.all([
    getPublicStatementFeedItems({
      fromIso: initialWindow.from,
      limit: STATEMENT_FEED_WINDOW_ITEM_LIMIT,
      toIso: initialWindow.to,
    }),
    hasPublicStatementFeedItemsBefore(initialWindow.from),
  ]);

  return (
    <StatementFeedShell
      initialHasMoreBefore={hasMoreBefore}
      initialItems={items}
      initialWindow={initialWindow}
    />
  );
}
