import { normalizeText } from "@/lib/party-statements/html";
import {
  getStatementSentenceSelectionMaxCandidates,
  getStatementSentenceSelectionMaxInputChars,
} from "./config";
import type {
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionRow,
} from "./types";
import { getUnusableCandidateReason } from "./heuristics";

const INLINE_BYLINE_RE =
  /\s*[|ㅣ]\s*[가-힣]{2,5}\s*(?:원내수석대변인|원내대변인|수석대변인|부대변인|대변인)\s*$/;
const AUTHOR_SUFFIX_RE = /\s*[|ㅣ]\s*[가-힣]{2,5}\s*$/;
const BRACKET_BYLINE_RE =
  /\s*\[[^\]]*(?:국민의힘|더불어민주당|개혁신당|대변인|논평|브리핑)[^\]]*\]\s*$/;

export function buildStatementSentenceCandidates(
  row: StatementSentenceSelectionRow,
) {
  const candidates: StatementSentenceSelectionCandidate[] = [];
  const seen = new Set<string>();

  if (row.title) {
    addTextCandidates({
      candidates,
      section: "title",
      seen,
      text: stripTitleByline(row.title),
    });
  }

  addTextCandidates({
    candidates,
    section: "body",
    seen,
    text: truncateText(row.textSnapshot),
  });

  return assignCandidateIds(
    candidates.slice(0, getStatementSentenceSelectionMaxCandidates()),
  );
}

function addTextCandidates({
  candidates,
  section,
  seen,
  text,
}: {
  candidates: Array<Omit<StatementSentenceSelectionCandidate, "id">>;
  section: StatementSentenceSelectionCandidate["section"];
  seen: Set<string>;
  text: string;
}) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return;
  }

  for (const block of splitIntoBlocks(normalizedText)) {
    if (isSingleSentenceCandidate(block)) {
      addCandidate({ candidates, section, seen, text: block });
    }

    for (const sentence of splitIntoSentences(block)) {
      addCandidate({ candidates, section, seen, text: sentence });
    }
  }
}

function addCandidate({
  candidates,
  section,
  seen,
  text,
}: {
  candidates: Array<Omit<StatementSentenceSelectionCandidate, "id">>;
  section: StatementSentenceSelectionCandidate["section"];
  seen: Set<string>;
  text: string;
}) {
  const candidate = normalizeCandidate(text);

  if (!isUsableCandidate(candidate) || seen.has(candidate)) {
    return;
  }

  seen.add(candidate);
  candidates.push({
    section,
    text: candidate,
  });
}

function splitIntoBlocks(text: string) {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitIntoSentences(text: string) {
  const normalized = text
    .split(/(?<=[.!?。！？])\s+/u)
    .flatMap((part) => splitLongKoreanSentence(part))
    .map((part) => part.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [text];
}

function splitLongKoreanSentence(text: string) {
  if (text.length <= 180) {
    return [text];
  }

  return text.split(/(?<=다\.|니다\.|십시오\.|까요\?|합니다\.|했습니다\.)\s*/u);
}

function normalizeCandidate(text: string) {
  return normalizeText(
    text
      .replace(/^[\s>*\-ㆍ·•○●■□◆◇▶▷✔✅🔥📍📰📝🔎]+/u, "")
      .replace(/^<[^>\r\n]{1,30}>\s*/u, "")
      .replace(/^\[[^\]\r\n]{1,30}\]\s*/u, "")
      .replace(BRACKET_BYLINE_RE, "")
      .replace(INLINE_BYLINE_RE, "")
      .replace(AUTHOR_SUFFIX_RE, ""),
  );
}

function stripTitleByline(title: string) {
  return normalizeText(
    title
      .replace(BRACKET_BYLINE_RE, "")
      .replace(INLINE_BYLINE_RE, "")
      .replace(AUTHOR_SUFFIX_RE, ""),
  );
}

function isUsableCandidate(text: string) {
  if (getUnusableCandidateReason(text)) {
    return false;
  }

  return /[가-힣a-zA-Z0-9]/.test(text);
}

function truncateText(text: string) {
  const maxChars = getStatementSentenceSelectionMaxInputChars();

  if (text.length <= maxChars) {
    return text;
  }

  return text.slice(0, maxChars).trimEnd();
}

function isSingleSentenceCandidate(text: string) {
  if (text.length > 180) {
    return false;
  }

  return countSentenceEndings(text) <= 1;
}

function countSentenceEndings(text: string) {
  return (text.match(/[.!?。！？]/g) ?? []).length;
}

function assignCandidateIds(
  candidates: Array<Omit<StatementSentenceSelectionCandidate, "id">>,
) {
  let titleIndex = 0;
  let bodyIndex = 0;

  return candidates.map((candidate) => {
    const index =
      candidate.section === "title" ? (titleIndex += 1) : (bodyIndex += 1);

    return {
      ...candidate,
      id: `${candidate.section === "title" ? "T" : "B"}${index}`,
    };
  });
}
