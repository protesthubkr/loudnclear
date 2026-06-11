import {
  absoluteUrl,
  decodeHtmlEntities,
  normalizeText,
  stripHtml,
} from "@/lib/party-statements/html";
import type { TelegramStatementDocumentType } from "@/lib/telegram-statements/types";

export function readXmlTag(xml: string, tagName: string) {
  return decodeHtmlEntities(
    xml
      .match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`))?.[1]
      ?.replace(/^<!\[CDATA\[/, "")
      .replace(/\]\]>$/, "") ?? "",
  );
}

export function parseRssDate(value: string) {
  const time = Date.parse(value);

  if (!Number.isFinite(time)) {
    return null;
  }

  return new Date(time).toISOString();
}

export function parseKoreanDateTime({
  date,
  time,
}: {
  date: string;
  time?: string | null;
}) {
  const dateMatch = normalizeText(date).match(
    /(20\d{2})[-.\/년\s]+(\d{1,2})[-.\/월\s]+(\d{1,2})/,
  );

  if (!dateMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch;
  const timeMatch = normalizeText(time ?? "").match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch?.[1] ?? "0";
  const minute = timeMatch?.[2] ?? "0";
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(
    2,
    "0",
  )}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+09:00`;
  const parsed = Date.parse(iso);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

export function inferWebDocumentType(
  title: string,
  rawCategory = "",
): TelegramStatementDocumentType {
  const text = `${rawCategory} ${title}`;

  if (/기자\s*회견|기자회견문|회견문/.test(text)) {
    return "press_conference";
  }

  if (/보도자료|후속보도자료|취재요청/.test(text)) {
    return "press_release";
  }

  if (/논평|브리핑/.test(text)) {
    return "commentary";
  }

  if (/성명|성명서|선언|시국선언/.test(text)) {
    return "statement";
  }

  if (/환영/.test(text)) {
    return "welcome";
  }

  if (/규탄/.test(text)) {
    return "condemnation";
  }

  return "position";
}

export function isTargetWebStatementCandidate({
  rawCategory = "",
  title,
}: {
  rawCategory?: string;
  title: string;
}) {
  const text = normalizeText(`${rawCategory} ${title}`);

  if (
    /행사|간담회|모집|토론회|자료집|뉴스레터|대회|함께\s*했(?:습니|어)|일정|캠페인/.test(
      text,
    )
  ) {
    return false;
  }

  return /성명|성명서|논평|보도자료|후속보도자료|취재요청|기자\s*회견|기자회견문|회견문|입장|의견서|선언|시국선언|규탄|촉구|요구|환영/.test(
    text,
  );
}

export function normalizeSourceUrl(value: string, baseUrl: string) {
  try {
    return absoluteUrl(value, baseUrl);
  } catch {
    return "";
  }
}

export function stripHtmlForDocument(html: string) {
  return stripHtml(
    html
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, " "),
  );
}

export function cleanTitle(value: string) {
  return normalizeText(stripHtml(value)).replace(/\s+/g, " ").trim();
}
