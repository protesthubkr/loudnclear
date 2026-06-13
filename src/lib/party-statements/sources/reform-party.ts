import {
  absoluteUrl,
  extractFirstMatch,
  mapPartyDocumentType,
  stripHtml,
} from "../html";
import type {
  PartyStatementDocument,
  PartyStatementListItem,
  PartyStatementListUrlContext,
  PartyStatementSourceParser,
} from "../types";
import { parsePartyPublishedAt } from "./published-at";
import { buildDocumentText } from "./source-utils";

const REFORM_PARTY_LIST_URL = "https://www.reformparty.kr/briefing";
const REFORM_PARTY_LIST_PAGE_SIZE = 10;
const REFORM_PARTY_BACKFILL_PAGE_COUNT = 3;

export const REFORM_PARTY_SOURCE: PartyStatementSourceParser = {
  buildListUrls: buildReformPartyListUrls,
  listUrl: REFORM_PARTY_LIST_URL,
  organizationName: "개혁신당",
  parseDetail: parseReformPartyDetail,
  parseList: parseReformPartyList,
  sourceKey: "reform_party",
};

function buildReformPartyListUrls({
  cutoffIso,
  limit,
}: PartyStatementListUrlContext) {
  const pageCount = cutoffIso
    ? REFORM_PARTY_BACKFILL_PAGE_COUNT
    : Math.min(
        REFORM_PARTY_BACKFILL_PAGE_COUNT,
        Math.max(1, Math.ceil(limit / REFORM_PARTY_LIST_PAGE_SIZE)),
      );

  return Array.from(
    { length: pageCount },
    (_, index) => `${REFORM_PARTY_LIST_URL}?page=${index + 1}`,
  );
}

function parseReformPartyList(html: string, listUrl: string) {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) ?? [];

  return rows.flatMap((row) => {
    const rawCategory = stripHtml(
      extractFirstMatch(row, /<a[^>]*class=["']bo_cate["'][^>]*>([\s\S]*?)<\/a>/i),
    );
    const documentType = mapPartyDocumentType(rawCategory);

    if (!documentType) {
      return [];
    }

    const href = extractFirstMatch(
      row,
      /<a\s+href=["']([^"']*\/briefing\/\d+[^"']*)["'][^>]*>/i,
    );
    const title = stripHtml(
      extractFirstMatch(row, /<div[^>]*class=["']bo_tit["'][^>]*>[\s\S]*?<a\s+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i),
    );
    const date = stripHtml(
      extractFirstMatch(row, /<td[^>]*class=["']td_datetime["'][^>]*>([\s\S]*?)<\/td>/i),
    );
    const externalId = href.match(/\/briefing\/(\d+)/)?.[1];

    if (!href || !title || !externalId) {
      return [];
    }

    const publishedAt = parsePartyPublishedAt(date);

    return [
      {
        documentType,
        externalId,
        ...publishedAt,
        rawCategory,
        sourceKey: "reform_party",
        sourceUrl: absoluteUrl(href, listUrl),
        title,
      } satisfies PartyStatementListItem,
    ];
  });
}

function parseReformPartyDetail(
  html: string,
  listItem: PartyStatementListItem,
) {
  const title =
    stripHtml(
      extractFirstMatch(
        html,
        /<span[^>]*class=["']bo_v_tit["'][^>]*>([\s\S]*?)<\/span>/i,
      ),
    ) || listItem.title;
  const date = stripHtml(
    extractFirstMatch(
      html,
      /<span[^>]*class=["']content if_date["'][^>]*>([\s\S]*?)<\/span>/i,
    ),
  );
  const bodyHtml = extractFirstMatch(
    html,
    /<div[^>]*id=["']bo_v_con["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  const textSnapshot = stripHtml(bodyHtml);

  if (!textSnapshot) {
    return null;
  }

  const publishedAt = parsePartyPublishedAt(date);

  return {
    ...listItem,
    organizationName: "개혁신당",
    ...(publishedAt.publishedAt ? publishedAt : pickListItemPublishedAt(listItem)),
    textSnapshot: buildDocumentText(title, textSnapshot),
    title,
  } satisfies PartyStatementDocument;
}

function pickListItemPublishedAt(listItem: PartyStatementListItem) {
  return {
    publishedAt: listItem.publishedAt,
    publishedAtPrecision: listItem.publishedAtPrecision,
    publishedAtTimeSource: listItem.publishedAtTimeSource,
  };
}
