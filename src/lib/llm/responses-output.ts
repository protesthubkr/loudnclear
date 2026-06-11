export function readResponsesOutputText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text.trim();
  }

  const chunks = collectResponseTextChunks(payload);

  return chunks.join("").trim();
}

export function parseResponsesJsonObject<T>(text: string): T {
  const normalized = text.trim();

  if (!normalized) {
    throw new Error("empty_output");
  }

  try {
    return JSON.parse(normalized) as T;
  } catch (firstError) {
    const objectText = extractJsonObjectText(normalized);

    if (!objectText || objectText === normalized) {
      throw firstError;
    }

    return JSON.parse(objectText) as T;
  }
}

function collectResponseTextChunks(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const chunks: string[] = [];
  collectTextFromValue(payload, chunks);

  return chunks;
}

function collectTextFromValue(value: unknown, chunks: string[]) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (
    "output_text" in value &&
    typeof value.output_text === "string" &&
    value.output_text.trim()
  ) {
    chunks.push(value.output_text);
  }

  if ("text" in value && typeof value.text === "string" && value.text.trim()) {
    chunks.push(value.text);
  }

  if ("parsed" in value && value.parsed && typeof value.parsed === "object") {
    chunks.push(JSON.stringify(value.parsed));
  }

  if (!("output" in value) || !Array.isArray(value.output)) {
    return;
  }

  for (const outputItem of value.output) {
    if (
      !outputItem ||
      typeof outputItem !== "object" ||
      !("content" in outputItem) ||
      !Array.isArray(outputItem.content)
    ) {
      continue;
    }

    for (const contentPart of outputItem.content) {
      collectTextFromValue(contentPart, chunks);
    }
  }
}

function extractJsonObjectText(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}
