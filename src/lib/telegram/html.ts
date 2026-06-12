import "server-only";

export const TELEGRAM_FETCH_USER_AGENT =
  "SeongmyeongMoongBot/1.0 (+https://seongmyeongmoong.local)";

const TELEGRAM_FETCH_MAX_ATTEMPTS = 3;
const TELEGRAM_FETCH_RETRY_BASE_MS = 600;
const TELEGRAM_TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export async function fetchTelegramHtml(url: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= TELEGRAM_FETCH_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetchTelegramHtmlAttempt(url);
    } catch (error) {
      lastError = error;

      if (attempt === TELEGRAM_FETCH_MAX_ATTEMPTS) {
        throw error;
      }

      await waitBeforeTelegramRetry(null, attempt);
      continue;
    }

    if (response.ok) {
      return response.text();
    }

    const error = new Error(`Telegram page request failed: ${response.status}`);
    lastError = error;

    if (
      !TELEGRAM_TRANSIENT_STATUS_CODES.has(response.status) ||
      attempt === TELEGRAM_FETCH_MAX_ATTEMPTS
    ) {
      throw error;
    }

    await waitBeforeTelegramRetry(response, attempt);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Telegram page request failed.");
}

async function fetchTelegramHtmlAttempt(url: string) {
  try {
    return await fetch(url, {
      headers: {
        "user-agent": TELEGRAM_FETCH_USER_AGENT,
      },
      next: { revalidate: 0 },
    });
  } catch (error) {
    throw error instanceof Error
      ? new Error(`Telegram page request failed: ${error.message}`)
      : new Error("Telegram page request failed.");
  }
}

async function waitBeforeTelegramRetry(response: Response | null, attempt: number) {
  const retryAfter = parseRetryAfterHeader(response?.headers.get("retry-after") ?? null);
  const delayMs = retryAfter ?? TELEGRAM_FETCH_RETRY_BASE_MS * 2 ** (attempt - 1);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function parseRetryAfterHeader(value: string | null) {
  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return Math.max(0, timestamp - Date.now());
}

export function getMetaContent(html: string, property: string) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedProperty}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i",
  );

  return regex.exec(html)?.[1] ?? "";
}

export function normalizeText(value: string) {
  return decodeHtmlEntities(value).replace(/\r\n/g, "\n").trim();
}

export function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

export function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name] ?? entity);
}
