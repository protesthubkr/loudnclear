import { normalizeText } from "@/lib/party-statements/html";
import { cleanTitle } from "@/lib/web-statements/source-utils";

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

export type NotionRecordMap = {
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

export function parseOopyPageProps(html: string) {
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

export function collectClimateAllListBlockIds(value: unknown) {
  const ids = new Set<string>();

  collectBlockIds(value, ids);

  return [...ids];
}

export function getNotionTitle(block?: NotionBlockValue) {
  return readNotionRichText(block?.properties?.title);
}

export function readClimateAllPageBody({
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

export function toIsoFromMillis(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
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
