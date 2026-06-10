import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";
import type { PartyStatementSourceKey } from "./types";

export type PartyStatementSummaryRow = {
  attempt_count: number;
  document_id: string;
  document_type: TelegramStatementDocumentType;
  id: string;
  organization_name: string;
  published_at: string | null;
  source_key: PartyStatementSourceKey;
  source_url: string;
  status: "pending" | "extracted" | "skipped" | "failed";
  title: string;
};
