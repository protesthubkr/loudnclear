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

const RAINBOW_BASE_URL = "https://rainbowaction.kr";
const RAINBOW_SOURCE_URL = "https://rainbowaction.kr/";
const RAINBOW_LIST_URL =
  "https://rainbowaction.kr/ajax/template/widget/board.cm?widgetCode=w202601155a82b9b5d5110&sectionCode=s20260115fbcb39d958649&menuCode=m20260106515334a453449&baseUrl=&back_url=/21&m=21";

export const RAINBOWACTION_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: RAINBOW_LIST_URL,
  organizationName: "무지개행동",
  parseDetail: parseRainbowActionDetail,
  parseList: parseRainbowActionList,
  requestHeaders: {
    accept: "text/html, */*; q=0.01",
    referer: "https://rainbowaction.kr/21",
    "x-requested-with": "XMLHttpRequest",
  },
  sourceKey: "rainbowactionkr",
  sourceUrl: RAINBOW_SOURCE_URL,
};

function parseRainbowActionList(html: string): WebStatementListItem[] {
  const seen = new Set<string>();

  return [...html.matchAll(/href=["']([^"']*idx=(\d+)[^"']*)["']/gi)].flatMap(
    (match) => {
      const [, href = "", externalId = ""] = match;

      if (!externalId || seen.has(externalId)) {
        return [];
      }

      seen.add(externalId);

      const segment = getRainbowActionListSegment(html, match.index ?? 0);
      const rawTitle =
        extractFirstMatch(
          segment,
          /<span\b[^>]*style=["'][^"']*cursor\s*:\s*pointer[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
        ) || extractFirstMatch(segment, /<a\b[^>]*>([\s\S]*?)<\/a>/i);
      const title = cleanTitle(rawTitle).replace(/^공지\s+/, "");

      if (!title) {
        return [];
      }

      const rawCategory = getRainbowActionCategory(segment);

      if (!isTargetWebStatementCandidate({ rawCategory, title })) {
        return [];
      }

      const dateText = cleanTitle(
        extractFirstMatch(
          segment,
          /<li\b[^>]*class=["'][^"']*\btime\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/i,
        ),
      );

      return [
        {
          documentType: inferWebDocumentType(title, rawCategory),
          externalId,
          publishedAt: parseKoreanDateTime({ date: dateText }),
          rawCategory,
          sourceKey: "rainbowactionkr",
          sourceUrl: normalizeSourceUrl(href, RAINBOW_BASE_URL),
          title,
        },
      ];
    },
  );
}

function parseRainbowActionDetail(
  html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  const rawCategory =
    cleanTitle(
      extractFirstMatch(
        html,
        /<span\b[^>]*class=["'][^"']*\bboard_name\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ),
    ) || listItem.rawCategory;
  const title =
    normalizeRainbowActionTitle(
      cleanTitle(
        extractFirstMatch(
          html,
          /<h1\b[^>]*class=["'][^"']*\bview_tit\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
        ),
      ),
      rawCategory,
    ) || listItem.title;

  if (!isTargetWebStatementCandidate({ rawCategory, title })) {
    return null;
  }

  const body = extractRainbowActionBody(html);

  if (!body) {
    return null;
  }

  return {
    ...listItem,
    documentType: inferWebDocumentType(title, rawCategory),
    organizationName: RAINBOWACTION_WEB_STATEMENT_SOURCE.organizationName,
    publishedAt: readRainbowActionPublishedAt(html) ?? listItem.publishedAt,
    rawCategory,
    textSnapshot: buildDocumentText(title, body),
    title,
  };
}

function getRainbowActionListSegment(html: string, matchIndex: number) {
  const start = html.lastIndexOf('<span class="post_link_wrap"', matchIndex);
  const fallbackStart = Math.max(0, matchIndex - 1200);
  const segmentStart = start >= 0 ? start : fallbackStart;
  const nextStart = html.indexOf('<span class="post_link_wrap"', matchIndex + 1);
  const segmentEnd =
    nextStart > matchIndex ? nextStart : Math.min(html.length, matchIndex + 1800);

  return html.slice(segmentStart, segmentEnd);
}

function getRainbowActionCategory(segment: string) {
  const categories = [...segment.matchAll(/<em\b[^>]*>([\s\S]*?)<\/em>/gi)]
    .map((match) => cleanTitle(match[1] ?? ""))
    .filter(Boolean);

  return (
    categories.find((category) => /성명|논평|보도자료|취재요청/.test(category)) ??
    categories[0] ??
    ""
  );
}

function readRainbowActionPublishedAt(html: string) {
  const content = extractFirstMatch(
    html,
    /<meta\b[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );

  return content ? parseKoreanDateTime({ date: content, time: content }) : null;
}

function extractRainbowActionBody(html: string) {
  const start = html.search(
    /<div\b[^>]*class=["'][^"']*\bboard_txt_area\b[^"']*\bfr-view\b[^"']*["'][^>]*>/i,
  );

  if (start < 0) {
    return "";
  }

  const endCandidates = [
    html.search(/<div\b[^>]*class=["'][^"']*\bcomment_area\b[^"']*["']/i),
    html.indexOf("</article>", start),
  ].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : undefined;
  const body = stripHtmlForDocument(html.slice(start, end));

  return normalizeText(body);
}

function normalizeRainbowActionTitle(title: string, rawCategory: string) {
  return normalizeText(
    title.replace(rawCategory, "").replace(/^공지\s+/, "").replace(/\s+/g, " "),
  );
}
