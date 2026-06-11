export type SentenceCompactionOutput = {
  compacted_sentence: string;
  reason: string;
  use_compacted: boolean;
};

export const EMPTY_SENTENCE_COMPACTION_OUTPUT = {
  compacted_sentence: "",
  reason: "",
  use_compacted: false,
} satisfies SentenceCompactionOutput;

export function parseSentenceCompactionOutput(
  text: string,
): SentenceCompactionOutput {
  try {
    const output = JSON.parse(text) as Partial<SentenceCompactionOutput>;

    return {
      compacted_sentence:
        typeof output.compacted_sentence === "string"
          ? output.compacted_sentence.trim()
          : "",
      reason: typeof output.reason === "string" ? output.reason.trim() : "",
      use_compacted: Boolean(output.use_compacted),
    };
  } catch {
    return {
      ...EMPTY_SENTENCE_COMPACTION_OUTPUT,
      reason: "invalid_json",
    };
  }
}

export async function readJsonSafely(response: Response) {
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

export function readOutputText(payload: unknown): string {
  return readResponsesOutputText(payload);
}
import { readResponsesOutputText } from "@/lib/llm/responses-output";
