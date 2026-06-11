import {
  extractFirstMatch,
  normalizeText,
  stripHtml,
} from "@/lib/party-statements/html";
import { buildDocumentText } from "@/lib/party-statements/sources/source-utils";
import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";
import {
  isTargetWebStatementCandidate,
  normalizeSourceUrl,
  parseRssDate,
  readXmlTag,
} from "@/lib/web-statements/source-utils";
import type {
  WebStatementDocument,
  WebStatementListItem,
  WebStatementSourceParser,
} from "../types";

const KFEM_BASE_URL = "https://kfem.or.kr";
const KFEM_RSS_URL = "https://kfem.or.kr/rss";
const KFEM_SECTION_PATH_RE =
  /^\/(energy|recycle|ocean|waterandriver|ecologicalpreservation|chemical|solidarity|environment)\//;
const KFEM_ITEM_RE = /<item>([\s\S]*?)<\/item>/g;

export const KFEM_WEB_STATEMENT_SOURCE: WebStatementSourceParser = {
  listUrl: KFEM_RSS_URL,
  organizationName: "환경운동연합",
  parseDetail: parseKfemDetail,
  parseList: parseKfemRssList,
  sourceKey: "kfem",
  sourceUrl: "https://www.kfem.or.kr/home",
};

function parseKfemRssList(xml: string): WebStatementListItem[] {
  return [...xml.matchAll(KFEM_ITEM_RE)].flatMap((match) => {
    const itemXml = match[1] ?? "";
    const sourceUrl = normalizeKfemUrl(readXmlTag(itemXml, "link"));
    const url = safeUrl(sourceUrl);

    if (!url || !KFEM_SECTION_PATH_RE.test(url.pathname)) {
      return [];
    }

    const externalId = url.searchParams.get("idx");

    if (!externalId) {
      return [];
    }

    const title = normalizeText(readXmlTag(itemXml, "title"));

    if (!title) {
      return [];
    }

    if (!isTargetWebStatementCandidate({ title })) {
      return [];
    }

    return [
      {
        documentType: inferKfemDocumentType(title, ""),
        externalId,
        publishedAt: parseRssDate(readXmlTag(itemXml, "pubDate")),
        rawCategory: "",
        sourceKey: "kfem",
        sourceUrl,
        title,
      },
    ];
  });
}

function parseKfemDetail(
  html: string,
  listItem: WebStatementListItem,
): WebStatementDocument | null {
  const titleHtml = extractFirstMatch(
    html,
    /<h1 class="view_tit">([\s\S]*?)<\/h1>/,
  );
  const rawCategory = normalizeText(
    stripHtml(
      extractFirstMatch(titleHtml, /<span class="category"[^>]*>([\s\S]*?)<\/span>/),
    ),
  );
  const title =
    normalizeKfemTitle(stripHtml(titleHtml), rawCategory) || listItem.title;
  const documentType = inferKfemDocumentType(title, rawCategory);

  if (!isKfemStatementCandidate({ rawCategory, title })) {
    return null;
  }

  const body = extractKfemBody(html);

  if (!body) {
    return null;
  }

  return {
    ...listItem,
    documentType,
    organizationName: KFEM_WEB_STATEMENT_SOURCE.organizationName,
    rawCategory,
    textSnapshot: buildDocumentText(title, body),
    title,
  };
}

function extractKfemBody(html: string) {
  const start = html.search(/<div class=['"]board_txt_area fr-view['"]>/);

  if (start < 0) {
    return "";
  }

  const end = html.indexOf("comment_section", start);
  const bodyHtml = html.slice(start, end > start ? end : undefined);

  return stripHtml(bodyHtml);
}

function isKfemStatementCandidate({
  rawCategory,
  title,
}: {
  rawCategory: string;
  title: string;
}) {
  if (rawCategory.includes("성명서·보도자료")) {
    return true;
  }

  return /(?:^|[\[\s_])(성명|성명서|논평|보도자료|취재요청|기자회견|기자회견문)(?:\]|[\s_]|$)/.test(
    title,
  );
}

function inferKfemDocumentType(
  title: string,
  rawCategory: string,
): TelegramStatementDocumentType {
  const text = `${rawCategory} ${title}`;

  if (/기자회견|기자회견문/.test(text)) {
    return "press_conference";
  }

  if (/보도자료|취재요청/.test(text)) {
    return "press_release";
  }

  if (/논평/.test(text)) {
    return "commentary";
  }

  if (/성명|성명서/.test(text)) {
    return "statement";
  }

  return "position";
}

function normalizeKfemTitle(rawTitle: string, rawCategory: string) {
  return normalizeText(
    rawTitle
      .replace(rawCategory, "")
      .replace(/\s*:?\s*환경운동연합\s*$/, "")
      .replace(/\s+/g, " "),
  );
}

function normalizeKfemUrl(value: string) {
  const url = safeUrl(value);

  if (!url) {
    return "";
  }

  const idx = url.searchParams.get("idx");
  const section = url.pathname.replace(/\/+$/, "");

  if (!idx) {
    return url.toString();
  }

  return `${KFEM_BASE_URL}${section}/?idx=${encodeURIComponent(
    idx,
  )}&bmode=view`;
}

function safeUrl(value: string) {
  try {
    return new URL(normalizeSourceUrl(value, KFEM_BASE_URL));
  } catch {
    return null;
  }
}
