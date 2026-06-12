export type PublicStatementFeedItem = {
  coreSentence: string;
  documentType: string;
  id: string;
  isTimeUnknown: boolean;
  messageCreatedAt: string | null;
  organizationName: string;
  sourceUrl: string;
  sourceType: "party" | "telegram" | "web";
};
