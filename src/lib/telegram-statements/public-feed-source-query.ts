export const HAS_MORE_BEFORE_CANDIDATE_LIMIT = 500;

export type PublicStatementSourceQuery = {
  fromIso?: string;
  limit: number;
  toIso?: string;
};

export function normalizeFeedSentence(value: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}
