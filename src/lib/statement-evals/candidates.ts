import {
  countIssueSignals,
  countStanceSignals,
  normalizeSpaces,
} from "./signals";
import type {
  StatementEvalCandidate,
  StatementEvalCandidateKind,
  StatementEvalCandidateSource,
  StatementEvalSourceRow,
} from "./types";

const MAX_CANDIDATES = 96;
const MIN_CANDIDATE_LENGTH = 8;
const MAX_CANDIDATE_LENGTH = 260;
const SENTENCE_TERMINATORS = new Set([".", "!", "?", "。", "！", "？"]);

const DOCUMENT_LABEL_RE =
  /^\s*(?:\[[^\]\n]{1,50}(?:성명|논평|브리핑|보도자료|기자회견|입장)[^\]\n]{0,30}\]\s*)+/;
const TRAILING_BYLINE_RE =
  /\s*(?:\[[^\]\n]{1,40}(?:대변인|부대변인|수석대변인|공보단장|대표)[^\]\n]*\]|[|｜-]\s*[가-힣]{2,5}\s*(?:대변인|부대변인|수석대변인|공보단장|대표)?)\s*$/;
const LEADING_BULLET_RE = /^\s*[>*\-–—•·●○■□▪▫]\s*/;
const CLAUSE_BOUNDARY_RE =
  /[,;]\s*|(?<=하며)\s+|(?<=하고)\s+|(?<=하면서)\s+|(?<=밝히고)\s+|(?<=열고)\s+/g;

export function buildStatementEvalCandidates(row: StatementEvalSourceRow) {
  const candidates: StatementEvalCandidate[] = [];
  const seen = new Set<string>();

  if (row.title) {
    addCandidate({
      candidates,
      kind: "title",
      seen,
      source: "title",
      sourceText: row.title,
      start: 0,
      text: cleanTitleCandidate(row.title),
    });
  }

  for (const block of splitBlocksWithOffsets(row.textSnapshot)) {
    const blockKind: StatementEvalCandidateKind =
      candidates.some((candidate) => candidate.source === "body")
        ? "sentence"
        : "lead";

    if (block.text.length <= 180) {
      addCandidate({
        candidates,
        kind: blockKind,
        seen,
        source: "body",
        sourceText: row.textSnapshot,
        start: block.start,
        text: block.text,
      });
    }

    for (const sentence of splitSentencesWithOffsets(block)) {
      addCandidate({
        candidates,
        kind: sentence.start <= block.start + 20 ? blockKind : "sentence",
        seen,
        source: "body",
        sourceText: row.textSnapshot,
        start: sentence.start,
        text: sentence.text,
      });

      if (sentence.text.length > 95) {
        for (const clause of splitClausesWithOffsets(sentence)) {
          addCandidate({
            candidates,
            kind: "clause",
            seen,
            source: "body",
            sourceText: row.textSnapshot,
            start: clause.start,
            text: clause.text,
          });
        }
      }
    }
  }

  return candidates
    .map((candidate, index) => ({
      ...candidate,
      id: candidate.id || buildCandidateId(candidate, index),
      rank: scoreCandidate(candidate),
    }))
    .sort((left, right) => right.rank - left.rank)
    .slice(0, MAX_CANDIDATES)
    .sort((left, right) => compareCandidateIds(left.id, right.id));
}

function addCandidate({
  candidates,
  kind,
  seen,
  source,
  sourceText,
  start,
  text,
}: {
  candidates: StatementEvalCandidate[];
  kind: StatementEvalCandidateKind;
  seen: Set<string>;
  source: StatementEvalCandidateSource;
  sourceText: string;
  start: number;
  text: string;
}) {
  const normalized = normalizeCandidate(text);
  const offset = sourceText.indexOf(text, Math.max(0, start - 2));
  const safeStart = offset >= 0 ? offset : sourceText.indexOf(normalized);
  const length = Array.from(normalized).length;

  if (
    safeStart < 0 ||
    length < MIN_CANDIDATE_LENGTH ||
    length > MAX_CANDIDATE_LENGTH ||
    seen.has(normalized)
  ) {
    return;
  }

  seen.add(normalized);
  candidates.push({
    end: safeStart + normalized.length,
    id: "",
    issueSignalCount: countIssueSignals(normalized),
    kind,
    rank: 0,
    source,
    stanceSignalCount: countStanceSignals(normalized),
    start: safeStart,
    text: normalized,
  });
}

function buildCandidateId(candidate: StatementEvalCandidate, index: number) {
  const prefix =
    candidate.source === "title" ? "T" : candidate.kind === "clause" ? "C" : "B";

  return `${prefix}${index + 1}`;
}

function scoreCandidate(candidate: StatementEvalCandidate) {
  const kindWeight =
    candidate.kind === "title"
      ? 8
      : candidate.kind === "lead"
        ? 7
        : candidate.kind === "clause"
          ? 6
          : 5;

  return (
    kindWeight +
    candidate.stanceSignalCount * 6 +
    Math.min(candidate.issueSignalCount, 8) * 1.2 -
    Math.max(0, candidate.text.length - 170) * 0.03
  );
}

function compareCandidateIds(left: string, right: string) {
  const leftPrefix = left[0] ?? "";
  const rightPrefix = right[0] ?? "";

  if (leftPrefix !== rightPrefix) {
    return leftPrefix.localeCompare(rightPrefix);
  }

  return Number(left.slice(1)) - Number(right.slice(1));
}

function normalizeCandidate(text: string) {
  return normalizeSpaces(
    text
      .replace(LEADING_BULLET_RE, "")
      .replace(DOCUMENT_LABEL_RE, "")
      .replace(TRAILING_BYLINE_RE, ""),
  );
}

function cleanTitleCandidate(title: string) {
  return title.replace(DOCUMENT_LABEL_RE, "").replace(TRAILING_BYLINE_RE, "").trim();
}

function splitBlocksWithOffsets(text: string) {
  const blocks: Array<{ start: number; text: string }> = [];
  const blockRe = /[^\r\n]+/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(text))) {
    const raw = match[0] ?? "";
    const trimmed = raw.trim();

    if (!trimmed) {
      continue;
    }

    blocks.push({
      start: (match.index ?? 0) + raw.indexOf(trimmed),
      text: trimmed,
    });
  }

  return blocks;
}

function splitSentencesWithOffsets(block: { start: number; text: string }) {
  const sentences: Array<{ start: number; text: string }> = [];
  let start = 0;

  for (let index = 0; index < block.text.length; index += 1) {
    const char = block.text[index];

    if (!char || !SENTENCE_TERMINATORS.has(char)) {
      continue;
    }

    if (char === "." && isDigit(block.text[index - 1]) && isDigit(block.text[index + 1])) {
      continue;
    }

    const sentence = trimWithOffset(block.text.slice(start, index + 1), start);

    if (sentence.text) {
      sentences.push({
        start: block.start + sentence.start,
        text: sentence.text,
      });
    }

    start = index + 1;
  }

  const rest = trimWithOffset(block.text.slice(start), start);

  if (rest.text) {
    sentences.push({
      start: block.start + rest.start,
      text: rest.text,
    });
  }

  return sentences;
}

function splitClausesWithOffsets(sentence: { start: number; text: string }) {
  const clauses: Array<{ start: number; text: string }> = [];
  const boundaryIndexes = [...sentence.text.matchAll(CLAUSE_BOUNDARY_RE)].map(
    (match) => (match.index ?? 0) + match[0].length,
  );

  for (const boundary of boundaryIndexes) {
    const clause = trimWithOffset(sentence.text.slice(boundary), boundary);

    if (
      clause.text.length >= 20 &&
      clause.text.length <= MAX_CANDIDATE_LENGTH &&
      countStanceSignals(clause.text) > 0
    ) {
      clauses.push({
        start: sentence.start + clause.start,
        text: clause.text,
      });
    }
  }

  return clauses;
}

function trimWithOffset(value: string, baseStart: number) {
  const leading = value.match(/^\s*/)?.[0].length ?? 0;
  const text = value.trim();

  return {
    start: baseStart + leading,
    text,
  };
}

function isDigit(value: string | undefined) {
  return Boolean(value && /\d/.test(value));
}
