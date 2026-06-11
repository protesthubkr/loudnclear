import { buildDocumentText } from "@/lib/party-statements/sources/source-utils";
import {
  cleanTitle,
  inferWebDocumentType,
  isTargetWebStatementCandidate,
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

const EQUALITYACT_BASE_URL = "https://equalityact.kr";
const EQUALITYACT_FEED_URL = "https://equalityact.kr/feed/";
const EQUALITYACT_ITEM_RE = /<item>([\s\S]*?)<\/item>/g;

export const EQUALITYACT_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: EQUALITYACT_FEED_URL,
  organizationName: "차제연",
  parseDetail: parseEqualityActDetail,
  parseList: parseEqualityActRssList,
  shouldFetchDetail: () => false,
  sourceKey: "equalact",
  sourceUrl: EQUALITYACT_BASE_URL,
};

function parseEqualityActRssList(xml: string): WebStatementListItem[] {
  return [...xml.matchAll(EQUALITYACT_ITEM_RE)].flatMap((match) => {
    const itemXml = match[1] ?? "";
    const title = cleanTitle(readXmlTag(itemXml, "title"));
    const link = normalizeSourceUrl(readXmlTag(itemXml, "link"), EQUALITYACT_BASE_URL);

    if (!title || !link) {
      return [];
    }

    const rawCategory = getEqualityActCategory(title);

    if (!isTargetWebStatementCandidate({ rawCategory, title })) {
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
        externalId: getEqualityActExternalId(link),
        publishedAt: parseRssDate(readXmlTag(itemXml, "pubDate")),
        rawCategory,
        sourceKey: "equalact",
        sourceUrl: link,
        textSnapshot: buildDocumentText(title, body),
        title,
      },
    ];
  });
}

function parseEqualityActDetail(
  _html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  if (!listItem.textSnapshot?.trim()) {
    return null;
  }

  return {
    ...listItem,
    organizationName: EQUALITYACT_WEB_STATEMENT_SOURCE.organizationName,
    textSnapshot: listItem.textSnapshot,
  };
}

function getEqualityActCategory(title: string) {
  return title.match(/\[([^\]]+)\]/)?.[1]?.trim() ?? "";
}

function getEqualityActExternalId(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");

    return path || url.toString();
  } catch {
    return sourceUrl;
  }
}
