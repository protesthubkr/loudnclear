import { getStatementCompactionMinChars } from "./extraction-config";
import type { TelegramStatementSentenceExtractionResult } from "./extractor-types";

const COMPACTED_SENTENCE_MIN_LENGTH = 32;
const COMPACTED_SENTENCE_MAX_LENGTH = 180;
const COMPACTED_SENTENCE_MIN_RATIO = 0.38;
const CONTEXTUAL_STANCE_RE =
  /(촉구|요구|규탄|비판|환영|우려|강조|밝혔|주장|제안|선언|결의|호소|반대|찬성|경고|고발|사과|철회|중단|멈추|보장|착수|추진|개혁|조사|규명|답하|책임|심판|쇄신|참사|침묵|짓밟|추모|애도|명복|기억하겠|기억하며|열겠|지키겠|만들겠|이어가겠|함께하겠|싸우겠|실현하겠|다하겠|바꾸겠|세우겠|나서|응할 것|해야 한다|해야 합니다)/;
const SENTENCE_END_RE =
  /(다|했다|하였다|합니다|했습니다|었습니다|였습니다|되었습니다|입니다|겠다|겠습니다|십시오|주십시오|바랍니다|빕니다|하라|하라!|하라\.|것인가|겁니까|습니까|입니까|아닙니까|해야 한다|해야 합니다)[.!?。！？]?$/;
const METADATA_CLEANUP_MIN_LENGTH = 12;
const METADATA_CLEANUP_MIN_RATIO = 0.2;
const LEADING_DECORATIVE_MARK_RE = /^\s*[-–—ㆍ·*■□◆◇▶▷●○※#]\s*/;
const LEADING_SPEAKER_LABEL_RE =
  /^\[[^\]\n]{1,24}(?:대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장|대표|위원장|원내대표|정책위의장|비상대책위원장)[^\]\n]{0,12}\]\s*/;
const TRAILING_SOURCE_LABEL_RE =
  /\s*\[[^\]\n]{1,80}(?:성명|논평|입장|보도자료|기자회견문|회견문|브리핑|대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장|대표|위원장|원내대표|정책위의장|비상대책위원장)[^\]\n]{0,30}\]\s*$/;
const CLEANUP_SIGNAL_RE =
  /(\[[^\]\n]{1,36}(?:대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장|대표|위원장|원내대표|정책위의장|비상대책위원장)[^\]\n]{0,16}\]|주요내용\s*\[보도자료\]|기자회견을\s*열고|브리핑|간담회|토론회|기자회견|^\s*[-–—ㆍ·*■□◆◇▶▷●○※#]\s*|^\s*[가-힣]{2,5}\s+(?:대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장)\s*[:：]|\[[^\]\n]{1,80}(?:성명|논평|입장|보도자료|기자회견문|회견문|브리핑|대변인|원내대변인|수석대변인|원내수석대변인|부대변인|공보단장)[^\]\n]{0,30}\]\s*$)/;

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

export function isMetadataStrippedSentenceSafe({
  compacted,
  original,
}: {
  compacted: string;
  original: string;
}) {
  const compactedLength = Array.from(compacted).length;
  const originalLength = Array.from(original).length;

  if (
    compactedLength < METADATA_CLEANUP_MIN_LENGTH ||
    compactedLength > COMPACTED_SENTENCE_MAX_LENGTH ||
    compactedLength >= originalLength ||
    compactedLength / originalLength < METADATA_CLEANUP_MIN_RATIO
  ) {
    return false;
  }

  return SENTENCE_END_RE.test(compacted);
}

export function getMetadataStrippedSentence(sentence: string) {
  const compacted = sentence
    .replace(LEADING_DECORATIVE_MARK_RE, "")
    .replace(LEADING_SPEAKER_LABEL_RE, "")
    .replace(TRAILING_SOURCE_LABEL_RE, "")
    .trim();

  if (compacted === sentence.trim()) {
    return null;
  }

  return compacted;
}

function hasSentenceCompactionSignal(sentence: string) {
  return CLEANUP_SIGNAL_RE.test(sentence);
}
