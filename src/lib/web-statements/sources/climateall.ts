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
import {
  collectClimateAllListBlockIds,
  getNotionTitle,
  parseOopyPageProps,
  readClimateAllPageBody,
  toIsoFromMillis,
} from "./climateall-notion";

const CLIMATEALL_BASE_URL = "https://www.climatejusticealliance.kr";

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
        publishedAt: toIsoFromMillis(
          block.created_time ?? block.last_edited_time,
        ),
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
