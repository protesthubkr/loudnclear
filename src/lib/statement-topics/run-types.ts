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
  partyUnmatched: number;
  telegramClusters: number;
  telegramSummariesSeen: number;
  windowHours: number;
};
