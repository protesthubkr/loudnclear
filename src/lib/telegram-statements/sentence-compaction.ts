import "server-only";

import { getReasoningRequestOptions } from "@/lib/llm/structured-event-config";
import {
  getStatementCompactionMaxOutputTokens,
  getStatementCompactionModel,
} from "./extraction-config";
import type { TelegramStatementSentenceExtractionResult } from "./extractor-types";
import {
  EMPTY_SENTENCE_COMPACTION_OUTPUT,
  parseSentenceCompactionOutput,
  readJsonSafely,
  readOutputText,
  type SentenceCompactionOutput,
} from "./sentence-compaction-output";
import {
  buildSentenceCompactionPrompt,
  COMPACTED_SENTENCE_PROMPT_VERSION,
  SENTENCE_COMPACTION_SCHEMA,
} from "./sentence-compaction-prompt";
import {
  getMetadataStrippedSentence,
  isCompactedSentenceSafe,
  isMetadataStrippedSentenceSafe,
  shouldTryCompaction,
} from "./sentence-compaction-safety";
import { findSentenceInSource } from "./sentence-match";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const METADATA_CLEANUP_VERSION = "statement_sentence_metadata_cleanup_v1";

export async function compactStatementExtractionIfUseful({
  extraction,
  textSnapshot,
}: {
  extraction: TelegramStatementSentenceExtractionResult;
  textSnapshot: string;
}) {
  const labelStrippedExtraction = stripMetadataIfSafe({
    extraction,
    textSnapshot,
  });

  if (!shouldTryCompaction(labelStrippedExtraction)) {
    return labelStrippedExtraction;
  }

  if (labelStrippedExtraction !== extraction) {
    extraction = labelStrippedExtraction;
  }

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
    !isMetadataStrippedSentenceSafe({
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

function stripMetadataIfSafe({
  extraction,
  textSnapshot,
}: {
  extraction: TelegramStatementSentenceExtractionResult;
  textSnapshot: string;
}) {
  const compacted = getMetadataStrippedSentence(extraction.coreSentence);

  if (!compacted) {
    return extraction;
  }

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
    promptVersion: `${extraction.promptVersion}+${METADATA_CLEANUP_VERSION}`,
    reason: `${extraction.reason}; compacted:metadata_cleanup`,
  };
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
      ...EMPTY_SENTENCE_COMPACTION_OUTPUT,
      reason: `openai_request_failed:${response.status}`,
    } satisfies SentenceCompactionOutput;
  }

  const text = readOutputText(payload);

  if (!text) {
    return {
      ...EMPTY_SENTENCE_COMPACTION_OUTPUT,
      reason: "empty_output",
    } satisfies SentenceCompactionOutput;
  }

  return parseSentenceCompactionOutput(text);
}
