import { extractFirstMatch, normalizeText } from "@/lib/party-statements/html";
import { buildDocumentText } from "@/lib/party-statements/sources/source-utils";
import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";
import {
  cleanTitle,
  normalizeSourceUrl,
  stripHtmlForDocument,
} from "@/lib/web-statements/source-utils";
import type {
  WebStatementDocument,
  WebStatementListItem,
  WebStatementSourceParser,
} from "../types";

const ANTIPOVERTY_BASE_URL = "http://antipoverty.kr";
const ANTIPOVERTY_LIST_URL = "http://antipoverty.kr/xe/announce";
const ANTIPOVERTY_SOURCE_KEY = "antipoverty";

export const ANTIPOVERTY_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: ANTIPOVERTY_LIST_URL,
  organizationName: "빈곤사회연대",
  parseDetail: parseAntipovertyDetail,
  parseList: parseAntipovertyList,
  sourceKey: ANTIPOVERTY_SOURCE_KEY,
  sourceUrl: ANTIPOVERTY_LIST_URL,
};

function parseAntipovertyList(html: string): WebStatementListItem[] {
  return [...html.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/gi)].flatMap(
    (match) => {
      const rowHtml = match[1] ?? "";
      const linkMatch = rowHtml.match(
        /<a\b(?=[^>]*\bhref=["']([^"']*\/announce\/(\d+)[^"']*)["'])(?=[^>]*\bclass=["'][^"']*\bsubject\b[^"']*["'])[^>]*>([\s\S]*?)<\/a>/i,
      );

      if (!linkMatch) {
        return [];
      }

      const [, href = "", externalId = "", titleHtml = ""] = linkMatch;
      const title = cleanTitle(titleHtml);

      if (!title || !isAntipovertyCandidate(title)) {
        return [];
      }

      const rawCategory = getTitleCategory(title);
      const dateText =
        cleanTitle(
          extractFirstMatch(
            rowHtml,
            /<td\b[^>]*class=["'][^"']*\bdate\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
          ),
        ) ||
        rowHtml.match(/20\d{2}[-.]\d{1,2}[-.]\d{1,2}/)?.[0] ||
        "";

      return [
        {
          documentType: inferAntipovertyDocumentType(title, rawCategory),
          externalId,
          publishedAt: parseAntipovertyDateTime(dateText),
          rawCategory,
          sourceKey: ANTIPOVERTY_SOURCE_KEY,
          sourceUrl: normalizeSourceUrl(href, ANTIPOVERTY_BASE_URL),
          title,
        },
      ];
    },
  );
}

function parseAntipovertyDetail(
  html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  const detailTitle =
    cleanTitle(
      extractFirstMatch(
        html,
        /<a\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
      ),
    ) || listItem.title;
  const title = detailTitle || listItem.title;
  const rawCategory = getTitleCategory(title) || listItem.rawCategory;

  if (!title || !isAntipovertyCandidate(title)) {
    return null;
  }

  const body = extractAntipovertyBody(html);

  if (!body) {
    return null;
  }

  return {
    ...listItem,
    documentType: inferAntipovertyDocumentType(title, rawCategory),
    organizationName: ANTIPOVERTY_WEB_STATEMENT_SOURCE.organizationName,
    publishedAt: parseAntipovertyDetailPublishedAt(html) ?? listItem.publishedAt,
    rawCategory,
    textSnapshot: buildDocumentText(title, body),
    title,
  };
}

function extractAntipovertyBody(html: string) {
  const start = html.search(
    /<div\b[^>]*class=["'][^"']*\bxe_content\b[^"']*["'][^>]*>/i,
  );

  if (start < 0) {
    return "";
  }

  const endCandidates = [
    html.indexOf("<!--AfterDocument", start),
    html.search(/<dl\b[^>]*class=["'][^"']*\battachedFile\b[^"']*["']/i),
    html.search(/<div\b[^>]*class=["'][^"']*\bboardReadFooter\b[^"']*["']/i),
  ].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : undefined;

  return normalizeText(stripHtmlForDocument(html.slice(start, end)));
}

function parseAntipovertyDetailPublishedAt(html: string) {
  const metaPublishedAt = getMetaContent(html, "article:published_time");

  if (metaPublishedAt) {
    const parsed = Date.parse(metaPublishedAt);

    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  const titleInfoDate = extractFirstMatch(
    html,
    /<i\b[^>]*title=["']등록일["'][^>]*><\/i>\s*<strong>([\s\S]*?)<\/strong>/i,
  );

  return parseAntipovertyDateTime(cleanTitle(titleInfoDate));
}

function getMetaContent(html: string, propertyName: string) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0] ?? "";
    const property = tag.match(/\bproperty=["']([^"']+)["']/i)?.[1];

    if (property !== propertyName) {
      continue;
    }

    return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "";
  }

  return "";
}

function getTitleCategory(title: string) {
  return normalizeText(title.match(/^\s*\[([^\]]{1,80})\]/)?.[1] ?? "");
}

function isAntipovertyCandidate(title: string) {
  const text = normalizeText(title);

  return /성\s*명|성명|논평|보도자료|취재요청|기자회견|기자회견문|입장|연대성명/.test(
    text,
  );
}

function inferAntipovertyDocumentType(
  title: string,
  rawCategory: string,
): TelegramStatementDocumentType {
  const text = normalizeText(`${rawCategory} ${title}`);

  if (/기자회견|취재요청/.test(text)) {
    return "press_conference";
  }

  if (/보도자료/.test(text)) {
    return "press_release";
  }

  if (/논평/.test(text)) {
    return "commentary";
  }

  if (/성\s*명|성명|연대성명/.test(text)) {
    return "statement";
  }

  if (/규탄/.test(text)) {
    return "condemnation";
  }

  if (/환영/.test(text)) {
    return "welcome";
  }

  return "position";
}

function parseAntipovertyDateTime(value: string) {
  const normalized = normalizeText(value);
  const match = normalized.match(
    /(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})(?:일)?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0",
  )}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(
    2,
    "0",
  )}+09:00`;
  const parsed = Date.parse(iso);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}
