import { getStatementCompactionMinChars } from "./extraction-config";
import type { TelegramStatementSentenceExtractionResult } from "./extractor-types";

const COMPACTED_SENTENCE_MIN_LENGTH = 32;
const COMPACTED_SENTENCE_MAX_LENGTH = 180;
const COMPACTED_SENTENCE_MIN_RATIO = 0.38;
const CONTEXTUAL_STANCE_RE =
  /(촉구|요구|규탄|비판|환영|우려|강조|밝혔|주장|제안|선언|결의|호소|반대|찬성|경고|고발|사과|철회|중단|보장|나서|응할 것|해야 한다|해야 합니다)/;
const SENTENCE_END_RE = /(다|했다|하였다|합니다|했습니다)[.!?。！？]?$/;

export function shouldTryCompaction(
  extraction: TelegramStatementSentenceExtractionResult,
) {
  return (
    extraction.isTargetDocument &&
    Array.from(extraction.coreSentence).length >= getStatementCompactionMinChars()
  );
}

export function isCompactedSentenceSafe({
  compacted,
  original,
}: {
  compacted: string;
  original: string;
}) {
  const compactedLength = Array.from(compacted).length;
  const originalLength = Array.from(original).length;

  if (
    compactedLength < COMPACTED_SENTENCE_MIN_LENGTH ||
    compactedLength > COMPACTED_SENTENCE_MAX_LENGTH ||
    compactedLength >= originalLength ||
    compactedLength / originalLength < COMPACTED_SENTENCE_MIN_RATIO
  ) {
    return false;
  }

  return CONTEXTUAL_STANCE_RE.test(compacted) && SENTENCE_END_RE.test(compacted);
}
