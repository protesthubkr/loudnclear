import { getStatementCompactionMinChars } from "./extraction-config";
import type { TelegramStatementSentenceExtractionResult } from "./extractor-types";

const COMPACTED_SENTENCE_MIN_LENGTH = 32;
const COMPACTED_SENTENCE_MAX_LENGTH = 180;
const COMPACTED_SENTENCE_MIN_RATIO = 0.38;
const CONTEXTUAL_STANCE_RE =
  /(촉구|요구|규탄|비판|환영|우려|강조|밝혔|주장|제안|선언|결의|호소|반대|찬성|경고|고발|사과|철회|중단|보장|착수|추진|개혁|조사|답하|책임|심판|쇄신|나서|응할 것|해야 한다|해야 합니다)/;
const SENTENCE_END_RE =
  /(다|했다|하였다|합니다|했습니다|겠다|겠습니다|십시오|하라|하라!|하라\.|해야 한다|해야 합니다)[.!?。！？]?$/;
const LEADING_SPEAKER_LABEL_RE =
  /^\[[^\]\n]{1,24}(?:대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장|대표|위원장|원내대표|정책위의장|비상대책위원장)[^\]\n]{0,12}\]\s*/;
const CLEANUP_SIGNAL_RE =
  /(\[[^\]\n]{1,36}(?:대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장|대표|위원장|원내대표|정책위의장|비상대책위원장)[^\]\n]{0,16}\]|주요내용\s*\[보도자료\]|기자회견을\s*열고|브리핑|간담회|토론회|기자회견|^\s*[가-힣]{2,5}\s+(?:대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장)\s*[:：])/;

export function shouldTryCompaction(
  extraction: TelegramStatementSentenceExtractionResult,
) {
  return (
    extraction.isTargetDocument &&
    (Array.from(extraction.coreSentence).length >=
      getStatementCompactionMinChars() ||
      hasSentenceCompactionSignal(extraction.coreSentence))
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

export function getLeadingSpeakerLabelStrippedSentence(sentence: string) {
  const compacted = sentence.replace(LEADING_SPEAKER_LABEL_RE, "").trim();

  if (compacted === sentence.trim()) {
    return null;
  }

  return compacted;
}

function hasSentenceCompactionSignal(sentence: string) {
  return CLEANUP_SIGNAL_RE.test(sentence);
}
