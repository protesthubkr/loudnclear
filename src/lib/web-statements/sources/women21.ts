import { extractFirstMatch, normalizeText } from "@/lib/party-statements/html";
import { buildDocumentText } from "@/lib/party-statements/sources/source-utils";
import {
  cleanTitle,
  inferWebDocumentType,
  isTargetWebStatementCandidate,
  normalizeSourceUrl,
  parseKoreanDateTime,
  stripHtmlForDocument,
} from "@/lib/web-statements/source-utils";
import type {
  WebStatementDocument,
  WebStatementListItem,
  WebStatementSourceParser,
} from "../types";

const WOMEN21_BASE_URL = "https://women21.or.kr";
const WOMEN21_LIST_URL = "https://women21.or.kr/statement/";

export const WOMEN21_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: WOMEN21_LIST_URL,
  organizationName: "여성연합",
  parseDetail: parseWomen21Detail,
  parseList: parseWomen21List,
  sourceKey: "kwau38",
  sourceUrl: WOMEN21_LIST_URL,
};

function parseWomen21List(html: string): WebStatementListItem[] {
  const listHtml = html.replace(/<!--/g, "").replace(/-->/g, "");

  return [...listHtml.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi)].flatMap(
    (match) => {
      const rowHtml = match[1] ?? "";
      const linkMatch = rowHtml.match(
        /<a\b[^>]*href=["']([^"']*\/statement\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
      );

      if (!linkMatch) {
        return [];
      }

      const [, href = "", externalId = "", titleHtml = ""] = linkMatch;
      const title = cleanTitle(titleHtml);

      if (!title) {
        return [];
      }

      const rawCategory = "성명·논평";

      if (!isTargetWebStatementCandidate({ rawCategory, title })) {
        return [];
      }

      const timeCellHtml = extractFirstMatch(
        rowHtml,
        /<td\b[^>]*class=["'][^"']*\btime\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      const timeTitle = rowHtml.match(
        /<td\b[^>]*class=["'][^"']*\btime\b[^"']*["'][^>]*title=["']([^"']+)["']/i,
      )?.[1];
      const dateText = cleanTitle(timeCellHtml);
      const publishedAt = parseKoreanDateTime({
        date: dateText,
        time: timeTitle || null,
      });

      return [
        {
          documentType: inferWebDocumentType(title, rawCategory),
          externalId,
          publishedAt,
          rawCategory,
          sourceKey: "kwau38",
          sourceUrl: normalizeSourceUrl(href, WOMEN21_BASE_URL),
          title,
        },
      ];
    },
  );
}

function parseWomen21Detail(
  html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  const title = listItem.title;
  const rawCategory = listItem.rawCategory;

  if (!isTargetWebStatementCandidate({ rawCategory, title })) {
    return null;
  }

  const body = extractWomen21Body(html);

  if (!body) {
    return null;
  }

  return {
    ...listItem,
    documentType: inferWebDocumentType(title, rawCategory),
    organizationName: WOMEN21_WEB_STATEMENT_SOURCE.organizationName,
    rawCategory,
    textSnapshot: buildDocumentText(title, body),
    title,
  };
}

function extractWomen21Body(html: string) {
  const start = html.search(
    /<div\b[^>]*class=["'][^"']*\bxe_content\b[^"']*["'][^>]*>/i,
  );

  if (start < 0) {
    return "";
  }

  const endCandidates = [
    html.indexOf("<!--AfterDocument", start),
    html.search(/<div\b[^>]*class=["'][^"']*\brd_ft\b[^"']*["']/i),
    html.indexOf("</article>", start),
  ].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : undefined;
  const body = stripHtmlForDocument(html.slice(start, end));

  return normalizeText(body);
}
