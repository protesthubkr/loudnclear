import { normalizeText } from "@/lib/party-statements/html";
import { getStatementDisplayDecisionContextChars } from "./config";
import { finalizeDisplaySentence } from "./postprocess";
import type { StatementDisplayCandidate, StatementDisplaySourceRow } from "./types";

const DEFAULT_MAX_CANDIDATES = 160;
const URL_RE = /https?:\/\/|www\.|t\.me\/|bit\.ly\/|forms\.gle|docs\.google\.com/i;
const HAS_TEXT_RE = /[\p{L}\p{N}]/u;
const HASH_TAG_ONLY_RE = /^#[^\s#]+(?:\s+#[^\s#]+)*$/;
const DATE_ONLY_RE =
  /^(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일\.?$|^\d{4}[.-]\d{1,2}[.-]\d{1,2}\.?$/;
const LABEL_ONLY_RE =
  /^(일시|시간|장소|문의|참가|참여|신청|주최|주관|후원|발언|사회|자료|링크|URL|사진|영상)\s*[:：]/;
const BYLINE_ONLY_RE =
  /^(?:국민의힘|더불어민주당|개혁신당|진보당|정의당|노동당|녹색당|참여연대|민주노총|전장연|공공운수|금속노조)?\s*[가-힣]{2,5}\s*(?:원내수석대변인|원내대변인|상근부대변인|수석대변인|부대변인|대변인|공보단장|대표|위원장)$/;
const INCOMPLETE_ENDING_RE =
  /(?:[,，、]|(?:이라며|라며|하며|하고|했지만|하지만|는데|이며|이고|위해|위한|통해|관련해|대해|따라|으로|로서|라는|인지))$/;
const STRONG_ENDING_RE =
  /(촉구했다|촉구한다|촉구합니다|요구했다|요구한다|요구합니다|규탄했다|규탄한다|규탄합니다|비판했다|비판한다|비판합니다|밝혔다|밝힌다|밝힙니다|제안했다|제안한다|제안합니다|선언했다|선언한다|선언합니다|주장했다|주장한다|주장합니다|호소했다|호소한다|호소합니다|강조했다|강조한다|강조합니다|다짐했다|다짐한다|다짐합니다|하겠습니다|겠습니다|해야 한다|해야 합니다|하십시오|하라|말라|마십시오|나섰다|전했다|했다|한다|합니다|입니다|다)$/;
const SENTENCE_END_RE = /[.!?。！？…]$/;

export function buildStatementDisplayCandidates(row: StatementDisplaySourceRow) {
  const candidates: StatementDisplayCandidate[] = [];
  const seen = new Set<string>();

  if (row.title) {
    addCandidate({
      candidates,
      kind: "title",
      section: "title",
      seen,
      text: row.title,
    });
  }

  const text = normalizeText(
    row.textSnapshot.slice(0, getStatementDisplayDecisionContextChars()),
  );
  const blocks = splitIntoBlocks(text);
  const leadBlocks = blocks.slice(0, 4);

  for (const block of leadBlocks) {
    addLeadCandidates({ block, candidates, seen });
  }

  for (const block of blocks) {
    for (const sentence of splitIntoSentences(block)) {
      addCandidate({
        candidates,
        kind: "sentence",
        section: "body",
        seen,
        text: sentence,
      });

      for (const clause of splitLongSentenceIntoClauses(sentence)) {
        addCandidate({
          candidates,
          kind: "clause",
          section: "body",
          seen,
          text: clause,
        });
      }
    }
  }

  return assignCandidateIds(candidates.slice(0, DEFAULT_MAX_CANDIDATES));
}

function addLeadCandidates({
  block,
  candidates,
  seen,
}: {
  block: string;
  candidates: Array<Omit<StatementDisplayCandidate, "id" | "rank">>;
  seen: Set<string>;
}) {
  const sentences = splitIntoSentences(block);
  const firstSentence = sentences[0];
  const firstTwoSentences = sentences.slice(0, 2).join(" ");

  if (firstSentence) {
    addCandidate({
      candidates,
      kind: "lead",
      section: "lead",
      seen,
      text: firstSentence,
    });
  }

  if (firstTwoSentences && firstTwoSentences !== firstSentence) {
    addCandidate({
      candidates,
      kind: "lead",
      section: "lead",
      seen,
      text: firstTwoSentences,
    });
  }
}

function addCandidate({
  candidates,
  kind,
  section,
  seen,
  text,
}: {
  candidates: Array<Omit<StatementDisplayCandidate, "id" | "rank">>;
  kind: StatementDisplayCandidate["kind"];
  section: StatementDisplayCandidate["section"];
  seen: Set<string>;
  text: string;
}) {
  const candidate = normalizeCandidateText(text);
  const key = normalizeCandidateKey(candidate);

  if (!isUsableCandidate(candidate) || seen.has(key)) {
    return;
  }

  seen.add(key);
  candidates.push({
    kind,
    section,
    text: candidate,
  });
}

function normalizeCandidateText(text: string) {
  return finalizeDisplaySentence(text)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCandidateKey(text: string) {
  return text.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
}

function splitIntoBlocks(text: string) {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitIntoSentences(text: string) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/(?<=[.!?。！？…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [normalized];
}

function splitLongSentenceIntoClauses(text: string) {
  if (text.length <= 170) {
    return [];
  }

  return text
    .split(/[,，;；]\s*/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24 && part.length <= 260)
    .filter((part) => STRONG_ENDING_RE.test(part))
    .map((part) => (SENTENCE_END_RE.test(part) ? part : `${part}.`));
}

export function isUsableDisplayText(text: string) {
  return getDisplayTextRejectReason(text) === null;
}

export function getDisplayTextRejectReason(text: string) {
  const normalized = normalizeText(text);

  if (normalized.length < 8) {
    return "too_short";
  }

  if (normalized.length > 480) {
    return "too_long";
  }

  if (!HAS_TEXT_RE.test(normalized)) {
    return "no_text";
  }

  if (
    URL_RE.test(normalized) ||
    HASH_TAG_ONLY_RE.test(normalized) ||
    DATE_ONLY_RE.test(normalized) ||
    LABEL_ONLY_RE.test(normalized)
  ) {
    return "url_or_label";
  }

  if (BYLINE_ONLY_RE.test(normalized)) {
    return "byline_only";
  }

  if (INCOMPLETE_ENDING_RE.test(normalized)) {
    return "incomplete_sentence";
  }

  return null;
}

function isUsableCandidate(text: string) {
  return isUsableDisplayText(text);
}

function assignCandidateIds(
  candidates: Array<Omit<StatementDisplayCandidate, "id" | "rank">>,
) {
  const counts = {
    body: 0,
    lead: 0,
    title: 0,
  };

  return candidates.map((candidate, index) => {
    counts[candidate.section] += 1;
    const prefix =
      candidate.section === "title"
        ? "T"
        : candidate.section === "lead"
          ? "L"
          : "B";

    return {
      ...candidate,
      id: `${prefix}${counts[candidate.section]}`,
      rank: index + 1,
    };
  });
}
