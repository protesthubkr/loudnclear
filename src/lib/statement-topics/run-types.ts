export type StatementTopicRunOptions = {
  dryRun?: boolean;
  limit?: number;
  windowHours?: number;
};

export type StatementTopicRunResult = {
  confirmedTopics: number;
  dryRun: boolean;
  embeddingsCreated: number;
  matchedPartyStatements: number;
  partyCandidatesSeen: number;
  primaryClusters: number;
  primarySummariesSeen: number;
  stalePartyMatchesCleared: number;
  partyUnmatched: number;
  telegramSummariesSeen: number;
  webSummariesSeen: number;
  windowHours: number;
  xSummariesSeen: number;
};
