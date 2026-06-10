import type { Metadata } from "next";
import { getPublicStatementFeedWindow } from "@/lib/telegram-statements/public-feed";
import {
  getCurrentStatementFeedWindow,
  STATEMENT_FEED_WINDOW_ITEM_LIMIT,
} from "@/lib/telegram-statements/public-feed-window";
import { StatementFeedShell } from "./statement-feed-shell";
import { SITE_DESCRIPTION, SITE_NAME } from "./site";

export const revalidate = 60;

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default async function HomePage() {
  const initialWindow = getCurrentStatementFeedWindow();
  const { hasMoreBefore, items } = await getPublicStatementFeedWindow({
    fromIso: initialWindow.from,
    limit: STATEMENT_FEED_WINDOW_ITEM_LIMIT,
    toIso: initialWindow.to,
  });

  return (
    <StatementFeedShell
      initialHasMoreBefore={hasMoreBefore}
      initialItems={items}
      initialWindow={initialWindow}
    />
  );
}
