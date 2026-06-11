export type StatementExtractionCandidate = {
  id: string;
  text: string;
};

const MAX_CANDIDATES = 50;
const MIN_CANDIDATE_LENGTH = 10;
const MAX_CANDIDATE_LENGTH = 260;

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
  const sentenceRe = /[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRe.exec(line)) !== null) {
    const sentence = match[0].replace(/\s+/g, " ").trim();

    if (sentence) {
      sentences.push(sentence);
    }
  }

  return sentences;
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
  const normalized = text.replace(/\s+/g, " ").trim();
  const length = Array.from(normalized).length;

  if (
    length < MIN_CANDIDATE_LENGTH ||
    length > MAX_CANDIDATE_LENGTH ||
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
  return (text.match(/[.!?。！？]+/g) ?? []).length;
}
