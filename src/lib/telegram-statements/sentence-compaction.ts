import "server-only";

import { getReasoningRequestOptions } from "@/lib/llm/structured-event-config";
import {
  getStatementCompactionInputChars,
  getStatementCompactionMaxOutputTokens,
  getStatementCompactionMinChars,
  getStatementCompactionModel,
} from "./extraction-config";
import type { TelegramStatementSentenceExtractionResult } from "./extractor-types";
import { findSentenceInSource } from "./sentence-match";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const COMPACTED_SENTENCE_PROMPT_VERSION = "statement_sentence_compaction_v2";
const COMPACTED_SENTENCE_MIN_LENGTH = 32;
const COMPACTED_SENTENCE_MAX_LENGTH = 180;
const COMPACTED_SENTENCE_MIN_RATIO = 0.38;
const CONTEXTUAL_STANCE_RE =
  /(촉구|요구|규탄|비판|환영|우려|강조|밝혔|주장|제안|선언|결의|호소|반대|찬성|경고|고발|사과|철회|중단|보장|나서|응할 것|해야 한다|해야 합니다)/;
const SENTENCE_END_RE = /(다|했다|하였다|합니다|했습니다)[.!?。！？]?$/;

const SENTENCE_COMPACTION_SCHEMA = {
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

type SentenceCompactionOutput = {
  compacted_sentence: string;
  reason: string;
  use_compacted: boolean;
};

export async function compactStatementExtractionIfUseful({
  extraction,
  textSnapshot,
}: {
  extraction: TelegramStatementSentenceExtractionResult;
  textSnapshot: string;
}) {
  if (!shouldTryCompaction(extraction)) {
    return extraction;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return extraction;
  }

  const model = getStatementCompactionModel();
  const output = await requestSentenceCompaction({
    apiKey,
    coreSentence: extraction.coreSentence,
    model,
    textSnapshot,
  });

  if (!output.use_compacted) {
    return extraction;
  }

  const compacted = output.compacted_sentence.replace(/\s+/g, " ").trim();
  const match = findSentenceInSource(textSnapshot, compacted);

  if (
    !match ||
    !isCompactedSentenceSafe({
      compacted: match.sentence,
      original: extraction.coreSentence,
    })
  ) {
    return extraction;
  }

  return {
    ...extraction,
    coreSentence: match.sentence,
    coreSentenceEnd: match.end,
    coreSentenceStart: match.start,
    model: `${extraction.model}+${model}`,
    promptVersion: `${extraction.promptVersion}+${COMPACTED_SENTENCE_PROMPT_VERSION}`,
    reason: `${extraction.reason}; compacted:${output.reason.trim()}`,
  };
}

function shouldTryCompaction(extraction: TelegramStatementSentenceExtractionResult) {
  return (
    extraction.isTargetDocument &&
    Array.from(extraction.coreSentence).length >= getStatementCompactionMinChars()
  );
}

async function requestSentenceCompaction({
  apiKey,
  coreSentence,
  model,
  textSnapshot,
}: {
  apiKey: string;
  coreSentence: string;
  model: string;
  textSnapshot: string;
}) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildSentenceCompactionPrompt({ coreSentence, textSnapshot }),
            },
          ],
        },
      ],
      max_output_tokens: getStatementCompactionMaxOutputTokens(),
      text: {
        format: {
          type: "json_schema",
          name: "statement_sentence_compaction",
          strict: true,
          schema: SENTENCE_COMPACTION_SCHEMA,
        },
      },
      ...getReasoningRequestOptions(model),
    }),
  });
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    return {
      compacted_sentence: "",
      reason: `openai_request_failed:${response.status}`,
      use_compacted: false,
    } satisfies SentenceCompactionOutput;
  }

  const text = readOutputText(payload);

  if (!text) {
    return {
      compacted_sentence: "",
      reason: "empty_output",
      use_compacted: false,
    } satisfies SentenceCompactionOutput;
  }

  try {
    const output = JSON.parse(text) as Partial<SentenceCompactionOutput>;

    return {
      compacted_sentence:
        typeof output.compacted_sentence === "string"
          ? output.compacted_sentence.trim()
          : "",
      reason: typeof output.reason === "string" ? output.reason.trim() : "",
      use_compacted: Boolean(output.use_compacted),
    } satisfies SentenceCompactionOutput;
  } catch {
    return {
      compacted_sentence: "",
      reason: "invalid_json",
      use_compacted: false,
    } satisfies SentenceCompactionOutput;
  }
}

function buildSentenceCompactionPrompt({
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
    "- 부가정보가 문장의 어디에 있든 덜어낼 수 있지만, 남기는 문구는 원문에 실제로 존재하는 연속된 문자열이어야 한다.",
    "- 단체의 판단/요구/비판/우려, 대상, 핵심 맥락이 함께 남아야 한다.",
    "- 핵심 맥락은 모든 배경 설명이 아니라, 누가/무엇에 대해 어떤 판단이나 요구를 하는지 이해되는 최소 맥락이다.",
    "- 맥락상 자르면 오해가 생기거나 대상이 불분명해지면 use_compacted=false로 답한다.",
    "- 행사 사실, 장소, 시각, 주최 단체명만 빠지는 것은 보통 핵심 맥락 손실로 보지 않는다.",
    "- 짧은 구호, 발언 일부, 인용문 조각만 남기지 않는다.",
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

function isCompactedSentenceSafe({
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

function truncateTextSnapshotForCompaction(textSnapshot: string) {
  const maxChars = getStatementCompactionInputChars();

  if (textSnapshot.length <= maxChars) {
    return textSnapshot;
  }

  return textSnapshot.slice(0, maxChars).trimEnd();
}

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if ("output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }

      const content = item.content;

      if (!Array.isArray(content)) {
        return [];
      }

      return content.flatMap((part) => {
        if (!part || typeof part !== "object") {
          return [];
        }

        if ("text" in part && typeof part.text === "string") {
          return [part.text];
        }

        return [];
      });
    })
    .join("")
    .trim();
}
