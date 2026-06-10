import type { StatementSentenceRole } from "./types";

const URL_RE = /https?:\/\/|www\.|t\.me\/|bit\.ly\/|forms\.gle|docs\.google\.com/i;
const HASH_TAG_ONLY_RE = /^#[^\s#]+(?:\s+#[^\s#]+)*$/;
const DATE_ONLY_RE =
  /^(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일\.?$|^\d{4}[.-]\d{1,2}[.-]\d{1,2}\.?$/;
const DATE_OR_LABEL_RE =
  /^(일시|시간|장소|문의|참가|참여|신청|주최|주관|후원|발언|사회|자료|링크|URL|사진|영상)\s*[:：]/;
const ORGANIZATION_PREFIX =
  "(?:국민의힘|더불어민주당|개혁신당|진보당|정의당|노동당|녹색당|참여연대|민주노총|전장연|공공운수|금속노조)";
const PERSON_TITLE =
  "(?:원내수석대변인|원내대변인|상근부대변인|수석대변인|부대변인|대변인|공보단장|대표|위원장)";
const BYLINE_ONLY_RE = new RegExp(
  `^(?:${ORGANIZATION_PREFIX}\\s*)?(?:(?:${PERSON_TITLE})\\s*)?[가-힣](?:\\s*[가-힣]){1,4}\\s*(?:${PERSON_TITLE})?$`,
);
const LONG_BYLINE_ONLY_RE = new RegExp(
  `^[가-힣\\s·()]{0,30}${PERSON_TITLE}\\s+[가-힣](?:\\s*[가-힣]){1,4}$`,
);
const INCOMPLETE_ENDING_RE =
  /(?:[,，、]|(?:이라며|라며|하며|하고|했지만|하지만|는데|이며|이고|위해|위한|통해|관련해|대해|따라|으로|로서|라는|인지))$/;
const NOTICE_OR_RESOURCE_RE =
  /(공동주최|주최|주관|개최|진행|신청|접수|모집|안내|발간|공개|소개|업로드|토론회|간담회|기자회견|집담회|웨비나|자료집|보고서|카드뉴스|영상|월간|웹자보|캠페인|라이브)/;
const BACKGROUND_ONLY_RE =
  /(유출되었|유출됐|발생했|발생하였|확인되었|확인됐|밝혀졌|드러났|나타났|집계되었|전해졌|알려졌|선출되었|선출됐|발표되었|발표됐)/;
const STANCE_ACTION_RE =
  /(촉구|요구|규탄|비판|고발|사과|철회|중단|폐지|사퇴|해임|책임|처벌|엄단|보장|반대|환영|지지|우려|경고|규명|개혁|바로잡|끝내|나서|응하|해야|하십시오|하라|밝힌다|밝힙니다|다짐|연대|거부|저지|심판|반성|해결|개선|확정해야|필요하다|불가피하다)/;

export const NON_DISPLAYABLE_SENTENCE_ROLES = new Set<StatementSentenceRole>([
  "context",
  "notice",
  "tribute",
  "resource_intro",
]);

export function getUnusableCandidateReason(text: string) {
  if (text.length < 8) {
    return "too_short";
  }

  if (text.length > 320) {
    return "too_long";
  }

  if (
    hasUrlOrLink(text) ||
    HASH_TAG_ONLY_RE.test(text) ||
    DATE_ONLY_RE.test(text) ||
    DATE_OR_LABEL_RE.test(text)
  ) {
    return "url_or_label";
  }

  if (isBylineOnly(text)) {
    return "byline_only";
  }

  if (isIncompleteFragment(text)) {
    return "incomplete_sentence";
  }

  if (isNoticeOrResourceWithoutStance(text)) {
    return "notice_or_resource_without_stance";
  }

  if (isBackgroundOnlyWithoutStance(text)) {
    return "background_without_stance";
  }

  return null;
}

export function hasUrlOrLink(text: string) {
  return URL_RE.test(text);
}

export function hasStanceAction(text: string) {
  return STANCE_ACTION_RE.test(text);
}

export function isBylineOnly(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  return (
    /대변인|공보단장|대표|위원장/.test(normalized) &&
    (BYLINE_ONLY_RE.test(normalized) || LONG_BYLINE_ONLY_RE.test(normalized))
  );
}

export function isIncompleteFragment(text: string) {
  return INCOMPLETE_ENDING_RE.test(text.trim());
}

export function isNoticeOrResourceWithoutStance(text: string) {
  return NOTICE_OR_RESOURCE_RE.test(text) && !hasStanceAction(text);
}

export function isBackgroundOnlyWithoutStance(text: string) {
  return BACKGROUND_ONLY_RE.test(text) && !hasStanceAction(text);
}
