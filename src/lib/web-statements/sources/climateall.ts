import { normalizeText } from "@/lib/party-statements/html";
import { buildDocumentText } from "@/lib/party-statements/sources/source-utils";
import {
  cleanTitle,
  inferWebDocumentType,
  isTargetWebStatementCandidate,
} from "@/lib/web-statements/source-utils";
import type {
  WebStatementDocument,
  WebStatementListItem,
  WebStatementSourceParser,
} from "../types";

const CLIMATEALL_BASE_URL = "https://www.climatejusticealliance.kr";
const NEXT_DATA_RE =
  /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const NOTION_TEXT_BLOCK_TYPES = new Set([
  "bulleted_list",
  "callout",
  "header",
  "numbered_list",
  "quote",
  "sub_header",
  "sub_sub_header",
  "text",
  "to_do",
  "toggle",
]);

type NotionBlockValue = {
  content?: string[];
  created_time?: number;
  id?: string;
  last_edited_time?: number;
  properties?: Record<string, unknown>;
  type?: string;
};

type NotionRecordMap = {
  block?: Record<string, { value?: NotionBlockValue }>;
};

type OopyNextData = {
  props?: {
    pageProps?: {
      queryCollectionResult?: unknown;
      recordMap?: NotionRecordMap;
    };
  };
};

export const CLIMATEALL_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: CLIMATEALL_BASE_URL,
  organizationName: "기후정의동맹",
  parseDetail: parseClimateAllDetail,
  parseList: parseClimateAllList,
  sourceKey: "climateall",
  sourceUrl: CLIMATEALL_BASE_URL,
};

function parseClimateAllList(html: string): WebStatementListItem[] {
  const pageProps = parseOopyPageProps(html);
  const recordMap = pageProps?.recordMap;

  if (!recordMap?.block) {
    return [];
  }

  const blockIds = collectClimateAllListBlockIds(
    pageProps?.queryCollectionResult,
  );

  return blockIds.flatMap((externalId) => {
    const block = recordMap.block?.[externalId]?.value;
    const title = cleanTitle(getNotionTitle(block));

    if (!block || !title) {
      return [];
    }

    const rawCategory = getClimateAllCategory(title);

    if (!isTargetWebStatementCandidate({ rawCategory, title })) {
      return [];
    }

    return [
      {
        documentType: inferWebDocumentType(title, rawCategory),
        externalId,
        publishedAt: toIsoFromMillis(block.created_time ?? block.last_edited_time),
        rawCategory,
        sourceKey: "climateall",
        sourceUrl: `${CLIMATEALL_BASE_URL}/${externalId}`,
        title,
      },
    ];
  });
}

function parseClimateAllDetail(
  html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  const pageProps = parseOopyPageProps(html);
  const recordMap = pageProps?.recordMap;
  const rootBlock = recordMap?.block?.[listItem.externalId]?.value;
  const title = cleanTitle(getNotionTitle(rootBlock)) || listItem.title;
  const rawCategory = getClimateAllCategory(title) || listItem.rawCategory;

  if (!recordMap || !rootBlock) {
    return null;
  }

  if (!isTargetWebStatementCandidate({ rawCategory, title })) {
    return null;
  }

  const body = readClimateAllPageBody({
    recordMap,
    rootBlockId: listItem.externalId,
    title,
  });

  if (!body) {
    return null;
  }

  return {
    ...listItem,
    documentType: inferWebDocumentType(title, rawCategory),
    organizationName: CLIMATEALL_WEB_STATEMENT_SOURCE.organizationName,
    publishedAt:
      toIsoFromMillis(rootBlock.created_time ?? rootBlock.last_edited_time) ??
      listItem.publishedAt,
    rawCategory,
    textSnapshot: buildDocumentText(title, body),
    title,
  };
}

function parseOopyPageProps(html: string) {
  const json = html.match(NEXT_DATA_RE)?.[1];

  if (!json) {
    return null;
  }

  try {
    const data = JSON.parse(json) as OopyNextData;

    return data.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

function collectClimateAllListBlockIds(value: unknown) {
  const ids = new Set<string>();

  collectBlockIds(value, ids);

  return [...ids];
}

function collectBlockIds(value: unknown, ids: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectBlockIds(item, ids);
    }

    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const blockIds = record.blockIds;

  if (Array.isArray(blockIds)) {
    for (const blockId of blockIds) {
      if (typeof blockId === "string") {
        ids.add(blockId);
      }
    }
  }

  for (const nested of Object.values(record)) {
    collectBlockIds(nested, ids);
  }
}

function readClimateAllPageBody({
  recordMap,
  rootBlockId,
  title,
}: {
  recordMap: NotionRecordMap;
  rootBlockId: string;
  title: string;
}) {
  const lines: string[] = [];
  const visited = new Set<string>();

  appendNotionBlockText({
    lines,
    recordMap,
    skipTitle: title,
    visited,
    blockId: rootBlockId,
  });

  return normalizeText(lines.join("\n"));
}

function appendNotionBlockText({
  blockId,
  lines,
  recordMap,
  skipTitle,
  visited,
}: {
  blockId: string;
  lines: string[];
  recordMap: NotionRecordMap;
  skipTitle: string;
  visited: Set<string>;
}) {
  if (visited.has(blockId)) {
    return;
  }

  visited.add(blockId);

  const block = recordMap.block?.[blockId]?.value;

  if (!block) {
    return;
  }

  const title = cleanTitle(getNotionTitle(block));

  if (
    title &&
    title !== skipTitle &&
    block.type &&
    NOTION_TEXT_BLOCK_TYPES.has(block.type)
  ) {
    lines.push(title);
  }

  for (const childId of block.content ?? []) {
    appendNotionBlockText({
      blockId: childId,
      lines,
      recordMap,
      skipTitle,
      visited,
    });
  }
}

function getNotionTitle(block?: NotionBlockValue) {
  return readNotionRichText(block?.properties?.title);
}

function readNotionRichText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (Array.isArray(part) && typeof part[0] === "string") {
        return part[0];
      }

      return readNotionRichText(part);
    })
    .join("");
}

function getClimateAllCategory(title: string) {
  const bracketCategory = title.match(/\[([^\]]+)\]/)?.[1]?.trim();

  if (bracketCategory) {
    return bracketCategory;
  }

  if (/기자회견/.test(title)) {
    return "기자회견";
  }

  if (/성명|논평|규탄|촉구|요구|입장/.test(title)) {
    return "성명";
  }

  return "알립니다";
}

function toIsoFromMillis(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}
