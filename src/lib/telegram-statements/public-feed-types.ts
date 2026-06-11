export type PublicStatementFeedItem = {
  coreSentence: string;
  documentType: string;
  id: string;
  isTimeUnknown: boolean;
  messageCreatedAt: string | null;
  organizationName: string;
  sourceUrl: string;
  sourceType: "party" | "telegram" | "web" | "x";
};

export type StatementSummaryPublicRow = {
  document_type: string;
  id: string;
  message_created_at: string | null;
  organization_name: string;
  source_url: string;
};

export type PartyStatementSummaryPublicRow = {
  created_at: string | null;
  document_type: string;
  id: string;
  organization_name: string;
  published_at: string | null;
  source_key: string | null;
  source_url: string;
  topic_gate_status: string;
};

export type XStatementSummaryPublicRow = {
  document_type: string;
  id: string;
  organization_name: string;
  posted_at: string | null;
  source_url: string;
};

export type WebStatementSummaryPublicRow = {
  document_type: string;
  id: string;
  organization_name: string;
  published_at: string | null;
  source_key: string;
  source_url: string;
};
