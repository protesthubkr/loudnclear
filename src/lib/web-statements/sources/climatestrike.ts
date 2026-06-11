import { buildDocumentText } from "@/lib/party-statements/sources/source-utils";
import {
  cleanTitle,
  inferWebDocumentType,
  normalizeSourceUrl,
  parseRssDate,
  readXmlTag,
  stripHtmlForDocument,
} from "@/lib/web-statements/source-utils";
import type {
  WebStatementDocument,
  WebStatementListItem,
  WebStatementSourceParser,
} from "../types";

const CLIMATESTRIKE_BASE_URL = "http://climate-strike.kr";
const CLIMATESTRIKE_FEED_URL = "http://climate-strike.kr/feed/";
const CLIMATESTRIKE_PRESS_URL = "http://climate-strike.kr/press/";
const CLIMATESTRIKE_ITEM_RE = /<item>([\s\S]*?)<\/item>/g;

export const CLIMATESTRIKE_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: CLIMATESTRIKE_FEED_URL,
  organizationName: "기후위기비상",
  parseDetail: parseClimateStrikeDetail,
  parseList: parseClimateStrikeRssList,
  shouldFetchDetail: () => false,
  sourceKey: "climatestrikekr",
  sourceUrl: CLIMATESTRIKE_PRESS_URL,
};

function parseClimateStrikeRssList(xml: string): WebStatementListItem[] {
  return [...xml.matchAll(CLIMATESTRIKE_ITEM_RE)].flatMap((match) => {
    const itemXml = match[1] ?? "";
    const title = cleanTitle(readXmlTag(itemXml, "title"));
    const link = normalizeSourceUrl(
      readXmlTag(itemXml, "link"),
      CLIMATESTRIKE_BASE_URL,
    );

    if (!title || !link) {
      return [];
    }

    const rawCategory = getClimateStrikeCategories(itemXml).join(", ");

    if (!isClimateStrikeCandidate({ rawCategory, title })) {
      return [];
    }

    const body =
      stripHtmlForDocument(readXmlTag(itemXml, "content:encoded")) ||
      stripHtmlForDocument(readXmlTag(itemXml, "description"));

    if (!body) {
      return [];
    }

    return [
      {
        documentType: inferWebDocumentType(title, rawCategory),
        externalId: getClimateStrikeExternalId(link),
        publishedAt: parseRssDate(readXmlTag(itemXml, "pubDate")),
        rawCategory,
        sourceKey: "climatestrikekr",
        sourceUrl: link,
        textSnapshot: buildDocumentText(title, body),
        title,
      },
    ];
  });
}

function parseClimateStrikeDetail(
  _html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  if (!listItem.textSnapshot?.trim()) {
    return null;
  }

  return {
    ...listItem,
    organizationName: CLIMATESTRIKE_WEB_STATEMENT_SOURCE.organizationName,
    textSnapshot: listItem.textSnapshot,
  };
}

function getClimateStrikeCategories(itemXml: string) {
  return [...itemXml.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)]
    .map((match) => cleanTitle(match[1] ?? ""))
    .filter(Boolean);
}

function isClimateStrikeCandidate({
  rawCategory,
  title,
}: {
  rawCategory: string;
  title: string;
}) {
  const text = `${rawCategory} ${title}`;
  const hasPressCategory = rawCategory.includes("언론 & 자료");
  const hasExplicitDocumentLabel =
    /^\s*\[(?:성명|논평|보도자료|취재요청|취재요청서|기자\s*회견|긴급\s*기자\s*회견|기자회견)\]/.test(
      title,
    );
  const hasTargetSignal =
    /성명|성명서|논평|보도자료|취재요청|취재요청서|기자\s*회견|기자회견문|입장|의견서|선언|시국선언|규탄|촉구|요구|환영/.test(
      text,
    );

  if (!hasTargetSignal || (!hasPressCategory && !hasExplicitDocumentLabel)) {
    return false;
  }

  if (/뉴스레터|활동가대회|전국\s*기후활동가\s*대회/.test(text)) {
    return false;
  }

  if (/토론회|대회|캠페인/.test(text) && !/규탄|촉구|요구/.test(text)) {
    return false;
  }

  return true;
}

function getClimateStrikeExternalId(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");

    return path || url.toString();
  } catch {
    return sourceUrl;
  }
}
