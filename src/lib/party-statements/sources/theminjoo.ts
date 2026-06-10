import {
  absoluteUrl,
  extractFirstMatch,
  mapPartyDocumentType,
  parseKoreanDateTime,
  stripHtml,
} from "../html";
import type {
  PartyStatementDocument,
  PartyStatementListItem,
  PartyStatementListUrlContext,
  PartyStatementSourceParser,
} from "../types";
import { buildDocumentText } from "./source-utils";

const THEMINJOO_STATEMENT_LIST_URL =
  "https://theminjoo.kr/main/sub/news/list.php?brd=188";
const THEMINJOO_BRIEFING_LIST_URL =
  "https://theminjoo.kr/main/sub/news/list.php?brd=11";
const THEMINJOO_LIST_PAGE_SIZE = 20;
const THEMINJOO_STATEMENT_BACKFILL_PAGE_COUNT = 2;
const THEMINJOO_BRIEFING_BACKFILL_PAGE_COUNT = 5;

export const THEMINJOO_SOURCE: PartyStatementSourceParser = {
  allowInsecureTls: true,
  buildListUrls: buildTheminjooListUrls,
  listUrl: THEMINJOO_STATEMENT_LIST_URL,
  organizationName: "민주당",
  parseDetail: parseTheminjooDetail,
  parseList: parseTheminjooList,
  sourceKey: "theminjoo",
};

function buildTheminjooListUrls(context: PartyStatementListUrlContext) {
  return [
    ...buildTheminjooPaginatedListUrls(
      THEMINJOO_STATEMENT_LIST_URL,
      getTheminjooPageCount(
        context,
        THEMINJOO_STATEMENT_BACKFILL_PAGE_COUNT,
      ),
    ),
    ...buildTheminjooPaginatedListUrls(
      THEMINJOO_BRIEFING_LIST_URL,
      getTheminjooPageCount(
        context,
        THEMINJOO_BRIEFING_BACKFILL_PAGE_COUNT,
      ),
    ),
  ];
}

function getTheminjooPageCount(
  { cutoffIso, limit }: PartyStatementListUrlContext,
  backfillPageCount: number,
) {
  if (cutoffIso) {
    return backfillPageCount;
  }

  return Math.min(
    backfillPageCount,
    Math.max(1, Math.ceil(limit / THEMINJOO_LIST_PAGE_SIZE)),
  );
}

function buildTheminjooPaginatedListUrls(
  listUrl: string,
  pageCount: number,
) {
  const brd = new URL(listUrl).searchParams.get("brd");

  return Array.from({ length: pageCount }, (_, index) => {
    if (index === 0 || !brd) {
      return listUrl;
    }

    return `https://theminjoo.kr/main/sub/news/list.php?sno=${
      index * THEMINJOO_LIST_PAGE_SIZE
    }&par=&&brd=${brd}`;
  });
}

function parseTheminjooList(html: string, listUrl: string) {
  return html
    .split(/<div\s+class=["']board-item\b/i)
    .slice(1)
    .flatMap((segment) => {
      const rawCategory = stripHtml(
        extractFirstMatch(
          segment,
          /<p[^>]*class=["']category["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i,
        ),
      );
      const documentType = mapPartyDocumentType(rawCategory);

      if (!documentType) {
        return [];
      }

      const href = extractFirstMatch(
        segment,
        /<a\s+href=["']([^"']*view\.php[^"']*)["'][^>]*>/i,
      );
      const title = stripHtml(
        extractFirstMatch(segment, /<a\s+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i),
      );
      const date = stripHtml(
        extractFirstMatch(segment, /<time[^>]*>([\s\S]*?)<\/time>/i),
      );
      const externalId = href.match(/[?&]post=(\d+)/)?.[1];

      if (!href || !title || !externalId) {
        return [];
      }

      return [
        {
          documentType,
          externalId,
          publishedAt: parseKoreanDateTime(date),
          rawCategory,
          sourceKey: "theminjoo",
          sourceUrl: absoluteUrl(href, listUrl),
          title,
        } satisfies PartyStatementListItem,
      ];
    });
}

function parseTheminjooDetail(
  html: string,
  listItem: PartyStatementListItem,
) {
  const rawCategory =
    stripHtml(
      extractFirstMatch(
        html,
        /<p[^>]*class=["']board-view__category["'][^>]*>([\s\S]*?)<\/p>/i,
      ),
    ) || listItem.rawCategory;
  const documentType = mapPartyDocumentType(rawCategory);

  if (!documentType) {
    return null;
  }

  const title =
    stripHtml(
      extractFirstMatch(html, /<h3[^>]*class=["']tit["'][^>]*>([\s\S]*?)<\/h3>/i),
    ) || listItem.title;
  const date = stripHtml(
    extractFirstMatch(html, /게시일\s*:\s*([0-9: -]+)/i),
  );
  const bodyHtml = extractFirstMatch(
    html,
    /<div[^>]*class=["']board-view__contents["'][^>]*>([\s\S]*?)<\/div>\s*<!--/i,
  );
  const textSnapshot = stripHtml(bodyHtml);

  if (!textSnapshot) {
    return null;
  }

  return {
    ...listItem,
    documentType,
    organizationName: "민주당",
    publishedAt: parseKoreanDateTime(date) ?? listItem.publishedAt,
    rawCategory,
    textSnapshot: buildDocumentText(title, textSnapshot),
    title,
  } satisfies PartyStatementDocument;
}
