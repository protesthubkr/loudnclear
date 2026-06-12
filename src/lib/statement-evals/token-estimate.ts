const ASCII_TOKEN_CHARS_RE = /[A-Za-z0-9_.,:;!?()[\]{}'"`~@#$%^&*+=\/\\|-]/g;
const WHITESPACE_RE = /\s+/g;

export function estimateLlmTokens(text: string) {
  const normalized = text.replace(WHITESPACE_RE, " ").trim();

  if (!normalized) {
    return 0;
  }

  const asciiChars = normalized.match(ASCII_TOKEN_CHARS_RE)?.length ?? 0;
  const whitespaceRuns = normalized.match(WHITESPACE_RE)?.length ?? 0;
  const totalChars = Array.from(normalized).length;
  const nonAsciiChars = Math.max(totalChars - asciiChars, 0);

  return Math.max(
    1,
    Math.ceil(asciiChars / 4 + nonAsciiChars / 1.7 + whitespaceRuns * 0.25),
  );
}
