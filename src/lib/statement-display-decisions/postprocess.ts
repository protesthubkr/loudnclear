import { normalizeText } from "@/lib/party-statements/html";

const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const URL_RESIDUE_RE = /https?:\/\/\S+|www\.\S+/i;
const HASH_TAG_RE = /#[^\s#]+/g;
const LEADING_ANGLE_LABEL_RE = /^\s*(?:<[^>\r\n]{1,40}>\s*)+/;
const LEADING_BULLET_RE = /^\s*(?:[>*\-•·◈◇◆△▲▶]+\s*|\d+[.)]\s+)/u;
const META_LABEL_KEYWORD_PATTERN = [
  "성명",
  "성명서",
  "공동성명",
  "긴급성명",
  "논평",
  "브리핑",
  "보도자료",
  "보도참고자료",
  "기자회견",
  "기자회견문",
  "입장",
  "입장문",
  "공지",
  "소식",
  "대변인",
  "부대변인",
  "원내대변인",
  "수석대변인",
  "원내수석대변인",
  "공보단장",
  "공보국",
].join("|");
const BRACKET_META_PATTERN = String.raw`\[[^\]\r\n]{0,80}(?:${META_LABEL_KEYWORD_PATTERN})[^\]\r\n]{0,80}\]`;
const LEADING_BRACKET_META_RE = new RegExp(
  String.raw`^\s*(?:${BRACKET_META_PATTERN}\s*)+`,
  "u",
);
const ANY_BRACKET_META_RE = new RegExp(
  String.raw`\s*${BRACKET_META_PATTERN}\s*`,
  "gu",
);
const ANY_BRACKET_META_RESIDUE_RE = new RegExp(BRACKET_META_PATTERN, "u");
const LEADING_PLAIN_LABEL_RE =
  /^\s*(?:(?:성명|성명서|논평|브리핑|보도자료|기자회견문|입장문)\s*[:|]\s*)+/u;
const TRAILING_BYLINE_RE =
  /\s*(?:[|·\-–—]\s*)?[\p{Script=Hangul}]{2,5}\s*(?:대변인|부대변인|원내대변인|수석대변인|원내수석대변인|공보단장|공보국장)\s*$/u;
const SUBTITLE_DASH_RE = /\s+[-–—]\s+([^-–—\r\n]{8,140})\s+[-–—]\s*$/u;
const SENTENCE_JOIN_FIX_RE =
  /((?:습니다|합니다|됩니다|겠습니다|입니다|였다|했다|한다|하라|십시오|마십시오|바랍니다|촉구합니다|촉구한다|요구합니다|요구한다|규탄합니다|규탄한다|제안합니다|제안한다|나아가겠습니다))\s+(?=[가-힣"'“‘A-Z0-9])/g;
const SENTENCE_END_RE = /[.!?。！？]$/u;

export function finalizeDisplaySentence(text: string) {
  return ensureTerminalPunctuation(
    normalizeText(
      text
        .replace(URL_RE, "")
        .replace(HASH_TAG_RE, "")
        .replace(ANY_BRACKET_META_RE, " ")
        .replace(LEADING_BRACKET_META_RE, "")
        .replace(LEADING_ANGLE_LABEL_RE, "")
        .replace(LEADING_PLAIN_LABEL_RE, "")
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
    ANY_BRACKET_META_RESIDUE_RE.test(text) ||
    LEADING_PLAIN_LABEL_RE.test(text) ||
    URL_RESIDUE_RE.test(text)
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
