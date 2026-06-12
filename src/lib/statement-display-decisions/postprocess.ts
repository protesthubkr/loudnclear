import { normalizeText } from "@/lib/party-statements/html";

const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const HASH_TAG_RE = /#[^\s#]+/g;
const LEADING_ANGLE_LABEL_RE = /^\s*(?:<[^>\r\n]{1,40}>\s*)+/;
const LEADING_BULLET_RE = /^\s*[>*\-•·■□○●▶▷△▲※]+\s*/;
const LEADING_BRACKET_META_RE =
  /^\s*(?:\[[^\]\r\n]{1,80}(?:성명|논평|브리핑|보도자료|기자회견|입장|대변인|부대변인|수석대변인|원내대변인|공보단장)[^\]\r\n]*\]\s*)+/;
const ANY_BRACKET_BYLINE_RE =
  /\s*\[[^\]\r\n]{1,80}(?:대변인|부대변인|수석대변인|원내대변인|공보단장|브리핑|논평)[^\]\r\n]*\]\s*/g;
const ANY_BRACKET_BYLINE_RESIDUE_RE =
  /\s*\[[^\]\r\n]{1,80}(?:대변인|부대변인|수석대변인|원내대변인|공보단장|브리핑|논평)[^\]\r\n]*\]\s*/;
const TRAILING_BYLINE_RE =
  /\s*(?:[|·-]\s*)?[가-힣]{2,5}\s*(?:대변인|부대변인|수석대변인|원내대변인|공보단장)\s*$/;
const SUBTITLE_DASH_RE = /\s+-\s+([^-\r\n]{8,120})\s+-\s*$/;
const SENTENCE_JOIN_FIX_RE =
  /(습니다|했습니다|합니다|하겠습니다|겠습니다|입니다|됩니다|했습니다|했습니다|했다|됐다|한다|된다|이다|하라|하십시오|마십시오|바랍니다|촉구합니다|촉구했다|요구합니다|요구했다|규탄합니다|규탄했다|제안한다|제안합니다|다짐합니다|나아가겠습니다|끝낼 때입니다|정면 도전입니다)\s+(?=[가-힣"'“‘])/g;
const SENTENCE_END_RE = /[.!?。！？…]$/;

export function finalizeDisplaySentence(text: string) {
  return ensureTerminalPunctuation(
    normalizeText(
      text
        .replace(URL_RE, "")
        .replace(HASH_TAG_RE, "")
        .replace(ANY_BRACKET_BYLINE_RE, " ")
        .replace(LEADING_BRACKET_META_RE, "")
        .replace(LEADING_ANGLE_LABEL_RE, "")
        .replace(LEADING_BULLET_RE, "")
        .replace(TRAILING_BYLINE_RE, "")
        .replace(SUBTITLE_DASH_RE, " $1")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(SENTENCE_JOIN_FIX_RE, "$1. "),
    ),
  );
}

export function hasDisplayPostprocessResidue(text: string) {
  return (
    LEADING_BRACKET_META_RE.test(text) ||
    LEADING_ANGLE_LABEL_RE.test(text) ||
    ANY_BRACKET_BYLINE_RESIDUE_RE.test(text) ||
    URL_RE.test(text)
  );
}

export function normalizeGroundingText(text: string) {
  return finalizeDisplaySentence(text)
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function ensureTerminalPunctuation(text: string) {
  const normalized = text.trim();

  if (!normalized || SENTENCE_END_RE.test(normalized)) {
    return normalized;
  }

  return `${normalized}.`;
}
