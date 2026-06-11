import { compareStatementItemsOldestFirst } from "@/lib/telegram-statements/public-feed-time";
import type { PublicStatementFeedItem } from "@/lib/telegram-statements/public-feed-types";

export function mergeStatementItems(
  prependedItems: PublicStatementFeedItem[],
  currentItems: PublicStatementFeedItem[],
) {
  const itemsById = new Map<string, PublicStatementFeedItem>();

  for (const item of prependedItems) {
    itemsById.set(item.id, item);
  }

  for (const item of currentItems) {
    itemsById.set(item.id, item);
  }

  return [...itemsById.values()].sort(compareStatementItemsOldestFirst);
}
