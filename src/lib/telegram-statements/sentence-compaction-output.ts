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
