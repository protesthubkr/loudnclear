export type StatementSentenceQualityInput = {
  confidence?: number | null;
  coreSentence: string | null;
  documentType?: string | null;
};

export type StatementSentenceQualityDecision = {
  publishable: boolean;
  reason: string;
};

const URL_RE =
  /(https?:\/\/|www\.|t\.me\/|bit\.ly\/|forms\.gle|docs\.google\.com|[a-z0-9-]+\.(?:kr|org|com|net)\/)/i;
const HASHTAG_ONLY_RE = /^#[^\s#]+(?:\s+#[^\s#]+)*$/;
const INTERNAL_INSTRUCTION_RE =
  /^\s*\d+\.\s*.*(해\s*주십시오|해주십시오|병행|배포|공유|전달)/;
const NOTICE_LEAD_RE =
  /^(일시|시간|장소|문의|참가|참여|신청|주최|주관|후원|프로그램|발언|사회|자료|링크|보도자료)\s*[:：]/;
const BUNDLED_LEAD_BLOCK_RE =
  /(?:\[\d{6}_|\r?\n\s*■|ㅣ\s*[가-힣]{2,5}\s*(?:수석대변인|부대변인|대변인).*\r?\n)/;
const PERSON_TITLE_RE =
  /[가-힣]{2,5}\s*(대표|위원장|부위원장|대변인|부대변인|수석대변인|원내대표|정책조직실장|실장|국장|본부장)\s*$/;
const DIRECT_STANCE_RE =
  /(규탄한다|규탄합니다|강력히\s*규탄|촉구한다|촉구합니다|요구한다|요구합니다|반대한다|반대합니다|비판한다|비판합니다|환영한다|환영합니다|우려한다|우려합니다|경고한다|경고합니다|고발한다|고발합니다|제안한다|제안합니다|선언한다|선언합니다|밝힌다|밝힙니다|다짐한다|다짐합니다|철회하라|중단하라|사퇴하라|해체하라|처벌하라|보장하라|사과하라|착수하라|수용\s*불가|마십시오|엄단해|싸우겠(?:다|습니다)|맞서\s*.*싸우|이어가겠습니다|함께하겠습니다|기억하겠습니다|기억하며|명복을\s*빕니다|책임져라|책임져야\s*한다|해야\s*한다|해야\s*합니다|만이\s*답입니다|것을\s*요구|것을\s*촉구|것임을\s*밝힌다)/;

export function getStatementSentenceQualityDecision(
  input: StatementSentenceQualityInput,
): StatementSentenceQualityDecision {
  const rawSentence = input.coreSentence ?? "";
  const sentence = normalizeSentence(input.coreSentence);

  if (!sentence) {
    return reject("empty_sentence");
  }

  if (BUNDLED_LEAD_BLOCK_RE.test(rawSentence)) {
    return reject("bundled_lead_block");
  }

  if (sentence.length < 10) {
    return reject("too_short");
  }

  if (sentence.length > 260) {
    return reject("too_long");
  }

  if (URL_RE.test(sentence)) {
    return reject("url_or_link");
  }

  if (HASHTAG_ONLY_RE.test(sentence)) {
    return reject("hashtag_only");
  }

  if (INTERNAL_INSTRUCTION_RE.test(sentence)) {
    return reject("internal_instruction");
  }

  if (NOTICE_LEAD_RE.test(sentence)) {
    return reject("notice_sentence");
  }

  if (looksLikePersonTitleOnly(sentence)) {
    return reject("person_title_only");
  }

  return {
    publishable: true,
    reason: "hard_safety_pass",
  };
}

export function isStatementSentencePublishable(
  input: StatementSentenceQualityInput,
) {
  return getStatementSentenceQualityDecision(input).publishable;
}

export function hasDirectStatementStance(text: string) {
  return DIRECT_STANCE_RE.test(normalizeSentence(text));
}

function reject(reason: string): StatementSentenceQualityDecision {
  return {
    publishable: false,
    reason,
  };
}

function normalizeSentence(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function looksLikePersonTitleOnly(sentence: string) {
  return PERSON_TITLE_RE.test(sentence) && !DIRECT_STANCE_RE.test(sentence);
}
