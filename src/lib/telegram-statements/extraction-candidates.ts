export type StatementExtractionCandidate = {
  id: string;
  text: string;
};

const MAX_CANDIDATES = 50;
const MIN_CANDIDATE_LENGTH = 10;
const MAX_CANDIDATE_LENGTH = 260;
const LEADING_BULLET_RE = /^\s*[-–—ㆍ·*]\s*/;
const LEADING_DOCUMENT_LABEL_RE =
  /^\[[^\]\n]{0,30}(?:성명|논평|입장|보도자료|기자회견문|회견문|브리핑)[^\]\n]{0,20}\]\s*/;
const DISPLAYABLE_SENTENCE_END_RE =
  /(다|했다|하였다|합니다|했습니다|겠다|겠습니다|십시오|하라|해야 한다|해야 합니다)[.!?。！？]?$/;

export function buildStatementExtractionCandidates(textSnapshot: string) {
  const candidates: StatementExtractionCandidate[] = [];
  const seen = new Set<string>();

  for (const line of splitLines(textSnapshot)) {
    if (countSentenceEndings(line) <= 1) {
      addCandidate({ candidates, seen, text: line });
    }

    for (const sentence of splitLineIntoSentences(line)) {
      addCandidate({ candidates, seen, text: sentence });
    }

    if (candidates.length >= MAX_CANDIDATES) {
      break;
    }
  }

  return candidates.slice(0, MAX_CANDIDATES).map((candidate, index) => ({
    ...candidate,
    id: `C${index + 1}`,
  }));
}

function splitLines(textSnapshot: string) {
  return textSnapshot
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitLineIntoSentences(line: string) {
  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < line.length; index += 1) {
    if (!isSentenceTerminator(line, index)) {
      continue;
    }

    let end = index + 1;

    while (end < line.length && isSentenceTerminator(line, end)) {
      end += 1;
    }

    sentences.push(line.slice(start, end).replace(/\s+/g, " ").trim());
    start = end;
  }

  const rest = line.slice(start).replace(/\s+/g, " ").trim();

  if (rest) {
    sentences.push(rest);
  }

  return sentences.filter(Boolean);
}

function addCandidate({
  candidates,
  seen,
  text,
}: {
  candidates: StatementExtractionCandidate[];
  seen: Set<string>;
  text: string;
}) {
  const normalized = normalizeCandidateText(text);
  const length = Array.from(normalized).length;

  if (
    length < MIN_CANDIDATE_LENGTH ||
    length > MAX_CANDIDATE_LENGTH ||
    looksLikeNonDisplayableHeadline(normalized) ||
    seen.has(normalized)
  ) {
    return;
  }

  seen.add(normalized);
  candidates.push({
    id: "",
    text: normalized,
  });
}

function countSentenceEndings(text: string) {
  let count = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (isSentenceTerminator(text, index)) {
      count += 1;
    }
  }

  return count;
}

function normalizeCandidateText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(LEADING_BULLET_RE, "")
    .replace(LEADING_DOCUMENT_LABEL_RE, "")
    .trim();
}

function looksLikeNonDisplayableHeadline(text: string) {
  return /[!?。！？]$/.test(text) && !DISPLAYABLE_SENTENCE_END_RE.test(text);
}

function isSentenceTerminator(text: string, index: number) {
  const char = text[index];

  if (!char || !/[.!?。！？]/.test(char)) {
    return false;
  }

  if (char === "." && isDigit(text[index - 1]) && isDigit(text[index + 1])) {
    return false;
  }

  return true;
}

function isDigit(value: string | undefined) {
  return Boolean(value && /\d/.test(value));
}
