import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export type WebStatementSourceKey =
  | "climateall"
  | "climatestrikekr"
  | "equalact"
  | "kfem"
  | "kwau38"
  | "rainbowactionkr";

export type WebStatementSourceDefinition = {
  listUrl: string;
  organizationName: string;
  requestHeaders?: Record<string, string>;
  sourceKey: WebStatementSourceKey;
  sourceUrl: string;
};

export type WebStatementListItem = {
  documentType: TelegramStatementDocumentType;
  externalId: string;
  publishedAt: string | null;
  rawCategory: string;
  sourceKey: WebStatementSourceKey;
  sourceUrl: string;
  textSnapshot?: string;
  title: string;
};

export type WebStatementDocument = WebStatementListItem & {
  organizationName: string;
  textSnapshot: string;
};

export type WebStatementSourceParser = WebStatementSourceDefinition & {
  parseDetail: (
    html: string,
    listItem: WebStatementListItem,
  ) => WebStatementDocument | null;
  parseList: (xml: string) => WebStatementListItem[];
  shouldFetchDetail?: (listItem: WebStatementListItem) => boolean;
};

export type WebStatementRunOptions = {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  source?: WebStatementSourceKey;
  windowHours?: number;
};

export type WebStatementRunOutcome = {
  documentType?: TelegramStatementDocumentType;
  externalId?: string;
  organizationName: string;
  sourceKey: WebStatementSourceKey;
  sourceUrl?: string;
  status:
    | "already_extracted"
    | "extracted"
    | "failed"
    | "seen"
    | "skipped";
  title?: string;
};

export type WebStatementRunSourceResult = {
  candidatesCreated: number;
  detailsFetched: number;
  documentsSeen: number;
  extracted: number;
  failed: number;
  outcomes: WebStatementRunOutcome[];
  outsideWindow: number;
  skipped: number;
  sourceKey: WebStatementSourceKey;
  stored: number;
};

export type WebStatementRunResult = {
  dryRun: boolean;
  extracted: number;
  failed: number;
  force: boolean;
  outsideWindow: number;
  results: WebStatementRunSourceResult[];
  skipped: number;
  sourcesSeen: number;
  stored: number;
};
