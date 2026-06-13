import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export type PartyStatementSourceKey =
  | "people_power_party"
  | "theminjoo"
  | "reform_party";

export type PartyStatementPublishedAtPrecision =
  | "unknown"
  | "date"
  | "hour"
  | "minute"
  | "second";

export type PartyStatementPublishedAtTimeSource = "source" | "collected";

export type PartyStatementSourceDefinition = {
  allowInsecureTls?: boolean;
  buildListUrls?: (context: PartyStatementListUrlContext) => string[];
  listUrl: string;
  listUrls?: string[];
  organizationName: string;
  sourceKey: PartyStatementSourceKey;
};

export type PartyStatementListUrlContext = {
  cutoffIso: string | null;
  limit: number;
};

export type PartyStatementListItem = {
  documentType: TelegramStatementDocumentType;
  externalId: string;
  publishedAt: string | null;
  publishedAtPrecision: PartyStatementPublishedAtPrecision;
  publishedAtTimeSource: PartyStatementPublishedAtTimeSource;
  rawCategory: string;
  sourceKey: PartyStatementSourceKey;
  sourceUrl: string;
  title: string;
};

export type PartyStatementDocument = PartyStatementListItem & {
  organizationName: string;
  textSnapshot: string;
};

export type PartyStatementSourceParser = PartyStatementSourceDefinition & {
  parseDetail: (
    html: string,
    listItem: PartyStatementListItem,
  ) => PartyStatementDocument | null;
  parseList: (html: string, listUrl: string) => PartyStatementListItem[];
};

export type PartyStatementRunOptions = {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  source?: PartyStatementSourceKey;
  summaryId?: string;
  windowHours?: number;
};
