import { getReasoningRequestOptions } from "@/lib/llm/structured-event-config";
import {
  getStatementSentenceSelectionMaxOutputTokens,
  getStatementSentenceSelectorModel,
  getStatementSentenceVerifierModel,
  STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION,
  STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION,
} from "./config";
import {
  STATEMENT_SENTENCE_SELECTOR_SCHEMA,
  STATEMENT_SENTENCE_VERIFIER_SCHEMA,
} from "./schemas";
import type {
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionRow,
  StatementSentenceSelectorOutput,
  StatementSentenceVerifierOutput,
} from "./types";
import {
  buildStatementSentenceSelectorPrompt,
  buildStatementSentenceVerifierPrompt,
} from "./prompts";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function selectStatementSentenceWithLlm({
  candidates,
  row,
}: {
  candidates: StatementSentenceSelectionCandidate[];
  row: StatementSentenceSelectionRow;
}) {
  const model = getStatementSentenceSelectorModel();
  const output = await requestStructuredOutput<StatementSentenceSelectorOutput>({
    formatName: "statement_sentence_selector",
    model,
    prompt: buildStatementSentenceSelectorPrompt({ candidates, row }),
    schema: STATEMENT_SENTENCE_SELECTOR_SCHEMA,
  });

  return {
    model,
    output: sanitizeSelectorOutput(output),
    promptVersion: STATEMENT_SENTENCE_SELECTOR_PROMPT_VERSION,
    rawOutput: output,
  };
}

export async function verifyStatementSentenceWithLlm({
  candidate,
  row,
}: {
  candidate: StatementSentenceSelectionCandidate;
  row: StatementSentenceSelectionRow;
}) {
  const model = getStatementSentenceVerifierModel();
  const output = await requestStructuredOutput<StatementSentenceVerifierOutput>({
    formatName: "statement_sentence_verifier",
    model,
    prompt: buildStatementSentenceVerifierPrompt({ candidate, row }),
    schema: STATEMENT_SENTENCE_VERIFIER_SCHEMA,
  });

  return {
    model,
    output: sanitizeVerifierOutput(output),
    promptVersion: STATEMENT_SENTENCE_VERIFIER_PROMPT_VERSION,
    rawOutput: output,
  };
}

async function requestStructuredOutput<T>({
  formatName,
  model,
  prompt,
  schema,
}: {
  formatName: string;
  model: string;
  prompt: string;
  schema: unknown;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("missing_openai_api_key");
  }

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
              text: prompt,
            },
          ],
        },
      ],
      max_output_tokens: getStatementSentenceSelectionMaxOutputTokens(),
      text: {
        format: {
          type: "json_schema",
          name: formatName,
          strict: true,
          schema,
        },
      },
      ...getReasoningRequestOptions(model),
    }),
  });
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(`openai_request_failed:${response.status}`);
  }

  const outputText = readOutputText(payload);

  if (!outputText) {
    throw new Error("empty_openai_output");
  }

  return JSON.parse(outputText) as T;
}

function sanitizeSelectorOutput(
  output: StatementSentenceSelectorOutput,
): StatementSentenceSelectorOutput {
  return {
    confidence: normalizeConfidence(output.confidence),
    displayable: Boolean(output.displayable),
    is_target_document: Boolean(output.is_target_document),
    reason: normalizeString(output.reason),
    selected_sentence_id:
      typeof output.selected_sentence_id === "string"
        ? output.selected_sentence_id.trim()
        : null,
    sentence_role: output.sentence_role,
    stance_action: normalizeNullableString(output.stance_action),
    target_subject: normalizeNullableString(output.target_subject),
  };
}

function sanitizeVerifierOutput(
  output: StatementSentenceVerifierOutput,
): StatementSentenceVerifierOutput {
  return {
    confidence: normalizeConfidence(output.confidence),
    displayable: Boolean(output.displayable),
    reason: normalizeString(output.reason),
    sentence_role: output.sentence_role,
    stance_action: normalizeNullableString(output.stance_action),
    target_subject: normalizeNullableString(output.target_subject),
  };
}

function normalizeConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), 100);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown) {
  const normalized = normalizeString(value);

  return normalized || null;
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
