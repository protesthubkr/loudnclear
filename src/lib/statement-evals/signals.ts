const ISSUE_GENERIC_TOKENS = new Set([
  "기자회견",
  "논평",
  "대변인",
  "보도자료",
  "브리핑",
  "성명",
  "입장",
  "오늘",
  "우리",
  "이번",
  "관련",
  "정부",
  "국회",
  "정당",
  "정치",
]);

const METADATA_SIGNAL_RE =
  /https?:\/\/|www\.|@\w+|#\S+|문의|담당자|보도자료|기자회견\s*안내|자료집|카드뉴스|^\[[^\]]{1,40}(성명|논평|브리핑|보도자료|기자회견)[^\]]*\]/i;

const STANCE_SIGNAL_RE =
  /(규탄|촉구|요구|비판|반대|우려|환영|지지|철회|중단|사과|책임|개혁|보장|처벌|수용|거부|연대|다짐|선언|경고|나서|이어가|멈추|바로잡|개선|추진|착수|해야|하라|말라|없다|있다|밝혔다|강조했다|호소했다)/g;

export function countStanceSignals(text: string) {
  return new Set(text.match(STANCE_SIGNAL_RE) ?? []).size;
}

export function countIssueSignals(text: string) {
  const tokens = text.match(/[가-힣A-Za-z0-9·.]{2,}/g) ?? [];
  const filtered = tokens.filter((token) => {
    if (ISSUE_GENERIC_TOKENS.has(token)) {
      return false;
    }

    return (
      /[0-9]/.test(token) ||
      /[A-Za-z]/.test(token) ||
      token.length >= 3 ||
      token.includes("·")
    );
  });

  return new Set(filtered).size;
}

export function hasMetadataLeft(text: string) {
  return METADATA_SIGNAL_RE.test(text);
}

export function isLengthOk(text: string) {
  const length = Array.from(text.trim()).length;

  return length >= 18 && length <= 220;
}

export function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
