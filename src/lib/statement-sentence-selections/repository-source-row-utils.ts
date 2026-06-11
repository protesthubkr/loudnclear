import type { StatementSentenceSelectionRow } from "./types";

export function compareSelectionRowsByDisplayAtDesc(
  left: StatementSentenceSelectionRow,
  right: StatementSentenceSelectionRow,
) {
  const leftTime = left.displayAt ? Date.parse(left.displayAt) : 0;
  const rightTime = right.displayAt ? Date.parse(right.displayAt) : 0;

  return rightTime - leftTime;
}
