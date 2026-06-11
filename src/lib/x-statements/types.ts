import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export type XStatementSource = {
  enabled: boolean;
  lastError: string | null;
  lastScannedAt: string | null;
  lastScannedPostAt: string | null;
  lastScannedPostId: string | null;
  organizationName: string;
  profileImageUrl: string | null;
  sourceKey: string;
  sourceUrl: string;
  username: string;
  xUserId: string | null;
};

export type XUser = {
  id: string;
  name: string;
  profile_image_url?: string;
  protected?: boolean;
  username: string;
  verified?: boolean;
  verified_type?: string;
};

export type XPost = {
  attachments?: {
    media_keys?: string[];
  };
  author_id?: string;
  conversation_id?: string;
  created_at?: string;
  edit_history_tweet_ids?: string[];
  entities?: unknown;
  id: string;
  note_tweet?: {
    text?: string;
  };
  referenced_tweets?: {
    id: string;
    type: "retweeted" | "quoted" | "replied_to";
  }[];
  text?: string;
};

export type XTimelineResponse = {
  data?: XPost[];
  errors?: unknown[];
  meta?: {
    newest_id?: string;
    next_token?: string;
    oldest_id?: string;
    result_count?: number;
  };
};

export type XUserResponse = {
  data?: XUser;
  errors?: unknown[];
};

export type XStatementPostRecord = {
  id: string;
  postedAt: string | null;
  sourceKey: string;
  sourceUrl: string;
  textSnapshot: string;
  xPostId: string;
};

export type XStatementCandidate = {
  detectionReason: string[];
  documentType: TelegramStatementDocumentType;
  post: XStatementPostRecord;
};

export type XStatementRunOptions = {
  dryRun?: boolean;
  maxPagesPerSource?: number;
  source?: string;
  startTime?: string;
};

export type XStatementSourceResult = {
  candidatesCreated: number;
  candidateMatches: number;
  extracted: number;
  failed: number;
  organizationName: string;
  postsSeen: number;
  postsWritten: number;
  skipped: number;
  sourceKey: string;
  username: string;
};

export type XStatementRunResult = {
  candidatesCreated: number;
  candidateMatches: number;
  dryRun: boolean;
  extracted: number;
  failed: number;
  postsSeen: number;
  postsWritten: number;
  results: XStatementSourceResult[];
  runId: string | null;
  skipped: number;
  sourcesScanned: number;
  startTime: string | null;
};
