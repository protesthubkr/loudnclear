import "server-only";

import { getMetaContent, normalizeText } from "./html";

const TELEGRAM_MESSAGE_IMAGE_CLASS_PATTERN =
  /<[^>]*\b(?:tgme_widget_message_photo_wrap|tgme_widget_message_video_thumb)\b[^>]*>/gi;

export function extractTelegramMessageImageUrls(html: string) {
  return uniqueNonEmpty([
    ...extractWidgetBackgroundImageUrls(html),
    normalizeText(getMetaContent(html, "og:image")),
  ]);
}

function extractWidgetBackgroundImageUrls(html: string) {
  return Array.from(html.matchAll(TELEGRAM_MESSAGE_IMAGE_CLASS_PATTERN))
    .map((match) => getStyleAttribute(match[0]))
    .map(extractBackgroundImageUrl)
    .filter(Boolean);
}

function getStyleAttribute(tag: string) {
  const match = tag.match(/\bstyle=(["'])([\s\S]*?)\1/i);
  return match?.[2] ?? "";
}

function extractBackgroundImageUrl(style: string) {
  const normalized = normalizeText(style);
  const match = normalized.match(
    /background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/i,
  );

  return normalizeText(match?.[2] ?? "");
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
