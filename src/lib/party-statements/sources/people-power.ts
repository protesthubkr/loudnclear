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
import { applyCollectedHour, parsePartyPublishedAt } from "./published-at";
import { buildDocumentText } from "./source-utils";

const PEOPLE_POWER_LIST_URL = "https://www.peoplepowerparty.kr/news/comment";
const PEOPLE_POWER_LIST_PAGE_SIZE = 10;
const PEOPLE_POWER_BACKFILL_PAGE_COUNT = 20;

export const PEOPLE_POWER_PARTY_SOURCE: PartyStatementSourceParser = {
  buildListUrls: buildPeoplePowerListUrls,
  listUrl: PEOPLE_POWER_LIST_URL,
  organizationName: "국힘당",
  parseDetail: parsePeoplePowerDetail,
  parseList: parsePeoplePowerList,
  sourceKey: "people_power_party",
};

function buildPeoplePowerListUrls({
  cutoffIso,
  limit,
}: PartyStatementListUrlContext) {
  const pageCount = cutoffIso
    ? PEOPLE_POWER_BACKFILL_PAGE_COUNT
    : Math.min(
        PEOPLE_POWER_BACKFILL_PAGE_COUNT,
        Math.max(1, Math.ceil(limit / PEOPLE_POWER_LIST_PAGE_SIZE)),
      );

  return Array.from(
    { length: pageCount },
    (_, index) =>
      `${PEOPLE_POWER_LIST_URL}?page=${index + 1}&gubun_list=all`,
  );
}

function parsePeoplePowerList(html: string) {
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];

  return rows.flatMap((row) => {
    const rawCategory = stripHtml(
      extractFirstMatch(row, /<td[^>]*class=["']class["'][^>]*>([\s\S]*?)<\/td>/i),
    );
    const documentType = mapPartyDocumentType(rawCategory);

    if (!documentType) {
      return [];
    }

    const href = extractFirstMatch(row, /<a\s+href=["']([^"']+)["'][^>]*>/i);
    const title = stripHtml(extractFirstMatch(row, /<a\s+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i));
    const date = stripHtml(
      extractFirstMatch(row, /<td[^>]*class=["']date["'][^>]*>([\s\S]*?)<\/td>/i),
    );
    const externalId = href.match(/comment_view_all\/(\d+)/)?.[1];

    if (!href || !title || !externalId) {
      return [];
    }

    const publishedAt = applyCollectedHour(
      parsePartyPublishedAt(date).publishedAt,
    );

    return [
      {
        documentType,
        externalId,
        ...publishedAt,
        rawCategory,
        sourceKey: "people_power_party",
        sourceUrl: absoluteUrl(href, PEOPLE_POWER_LIST_URL),
        title,
      } satisfies PartyStatementListItem,
    ];
  });
}

function parsePeoplePowerDetail(
  html: string,
  listItem: PartyStatementListItem,
) {
  const title =
    stripHtml(
      extractFirstMatch(html, /<dt[^>]*class=["']sbj["'][^>]*>([\s\S]*?)<\/dt>/i),
    ) || listItem.title;
  const date = stripHtml(
    extractFirstMatch(html, /<dd[^>]*class=["']date["'][^>]*>[\s\S]*?<span>작성일<\/span>([\s\S]*?)<\/dd>/i),
  );
  const bodyHtml = extractFirstMatch(
    html,
    /<dd[^>]*class=["']conts["'][^>]*>([\s\S]*?)<\/dd>/i,
  );
  const textSnapshot = stripHtml(bodyHtml);

  if (!textSnapshot) {
    return null;
  }

  const publishedAt = applyCollectedHour(parsePartyPublishedAt(date).publishedAt);

  return {
    ...listItem,
    organizationName: "국힘당",
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
