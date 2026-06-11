import { getStatementCompactionInputChars } from "./extraction-config";

export const COMPACTED_SENTENCE_PROMPT_VERSION =
  "statement_sentence_compaction_v3";

export const SENTENCE_COMPACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["use_compacted", "compacted_sentence", "reason"],
  properties: {
    use_compacted: {
      type: "boolean",
    },
    compacted_sentence: {
      type: "string",
    },
    reason: {
      type: "string",
    },
  },
} as const;

export function buildSentenceCompactionPrompt({
  coreSentence,
  textSnapshot,
}: {
  coreSentence: string;
  textSnapshot: string;
}) {
  return [
    "성명뭉 공개 피드에 표시할 핵심 문장을 더 짧게 고를지 판단한다.",
    "",
    "원칙:",
    "- 새 문장을 만들거나 요약하지 않는다.",
    "- compacted_sentence는 원문에 실제로 존재하는 연속된 문자열이어야 한다.",
    "- 현재 핵심 문장이 제목, 구호, 행사 설명, 장소, 시간, 단체 소개 같은 부가정보와 핵심 요구가 한 문장에 함께 붙어서 너무 길 때만 줄인다.",
    "- 발화자 라벨, 직함 표기, 브리핑 제목, 보도자료 머리말, 행사명, 인용문 앞뒤 설명처럼 피드에서 핵심 판단을 흐리는 메타데이터가 앞뒤에 붙어 있으면 덜어낸다.",
    "- 특히 '[이름 직함]' 같은 발화자 표시는 보통 핵심 문장이 아니므로, 그 뒤 문장만으로 판단/요구가 충분히 성립하면 제거한다.",
    "- 부가정보가 문장의 어디에 있든 덜어낼 수 있지만, 남기는 문구는 원문에 실제로 존재하는 연속된 문자열이어야 한다.",
    "- 단체의 판단/요구/비판/우려, 대상, 핵심 맥락이 함께 남아야 한다.",
    "- 핵심 맥락은 모든 배경 설명이 아니라, 누가/무엇에 대해 어떤 판단이나 요구를 하는지 이해되는 최소 맥락이다.",
    "- 맥락상 자르면 오해가 생기거나 대상이 불분명해지면 use_compacted=false로 답한다.",
    "- 행사 사실, 장소, 시각, 주최 단체명만 빠지는 것은 보통 핵심 맥락 손실로 보지 않는다.",
    "- 짧은 구호, 발언 일부, 인용문 조각만 남기지 않는다.",
    "- 단순히 더 짧게 만들기 위해 핵심 주체, 대상, 요구 동사를 잃으면 안 된다.",
    "- 후보가 너무 짧거나 독립적으로 의미가 통하지 않으면 use_compacted=false로 답한다.",
    "",
    "좋은 축약 예:",
    "원문 핵심: 경기지역 대학 미화·경비노동자들 “진짜 사장이 나와라” 공공운수노조 경기지역지부가 10일 12시 명지대학교 창조관 앞에서 기자회견을 열고, 경기지역 대학당국이 간접고용 미화·경비 노동자들의 실질적인 사용자로서 원청교섭에 즉각 응할 것을 촉구했다.",
    "compacted_sentence: 경기지역 대학당국이 간접고용 미화·경비 노동자들의 실질적인 사용자로서 원청교섭에 즉각 응할 것을 촉구했다.",
    "",
    `현재 핵심 문장:\n${coreSentence}`,
    "",
    `원문:\n${truncateTextSnapshotForCompaction(textSnapshot)}`,
  ].join("\n");
}

function truncateTextSnapshotForCompaction(textSnapshot: string) {
  const maxChars = getStatementCompactionInputChars();

  if (textSnapshot.length <= maxChars) {
    return textSnapshot;
  }

  return textSnapshot.slice(0, maxChars).trimEnd();
}
