import { getReasoningRequestOptions } from "@/lib/llm/structured-event-config";
import {
  parseResponsesJsonObject,
  readResponsesOutputText,
} from "@/lib/llm/responses-output";
import {
  getStatementDisplayDecisionDefaultReasoningEffort,
  getStatementDisplayDecisionMaxOutputTokens,
  getStatementDisplayDecisionModel,
  STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
  STATEMENT_DISPLAY_DECISION_REASONING_ENV_KEY,
} from "./config";
import { buildStatementDisplayDecisionPrompt } from "./prompts";
import { STATEMENT_DISPLAY_DECISION_SCHEMA } from "./schemas";
import type {
  StatementDisplayComparatorOutput,
  StatementDisplayCandidate,
  StatementDisplaySourceRow,
} from "./types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function compareStatementDisplayDecisionWithLlm({
  candidates,
  row,
}: {
  candidates: StatementDisplayCandidate[];
  row: StatementDisplaySourceRow;
}) {
  const model = getStatementDisplayDecisionModel();
  const output = await requestStructuredOutput<StatementDisplayComparatorOutput>({
    formatName: "statement_display_decision",
    model,
    prompt: buildStatementDisplayDecisionPrompt({ candidates, row }),
    schema: STATEMENT_DISPLAY_DECISION_SCHEMA,
  });

  return {
    model,
    output: sanitizeComparatorOutput(output),
    promptVersion: STATEMENT_DISPLAY_DECISION_PROMPT_VERSION,
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
      max_output_tokens: getStatementDisplayDecisionMaxOutputTokens(),
      text: {
        format: {
          type: "json_schema",
          name: formatName,
          strict: true,
          schema,
        },
      },
      ...getReasoningRequestOptions(model, {
        defaultEffort: getStatementDisplayDecisionDefaultReasoningEffort(),
        effortEnvKey: STATEMENT_DISPLAY_DECISION_REASONING_ENV_KEY,
      }),
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

  return parseResponsesJsonObject<T>(outputText);
}

function sanitizeComparatorOutput(
  output: StatementDisplayComparatorOutput,
): StatementDisplayComparatorOutput {
  return {
    candidate_a_sentence: normalizeNullableString(output.candidate_a_sentence),
    candidate_a_source_ids: normalizeSourceIds(output.candidate_a_source_ids),
    candidate_c_sentence: normalizeNullableString(output.candidate_c_sentence),
    candidate_c_source_ids: normalizeSourceIds(output.candidate_c_source_ids),
    chosen_candidate:
      output.chosen_candidate === "A" ||
      output.chosen_candidate === "C" ||
      output.chosen_candidate === "none"
        ? output.chosen_candidate
        : "none",
    confidence: normalizeConfidence(output.confidence),
    core_sentence: normalizeNullableString(output.core_sentence),
    display_sentence: normalizeNullableString(output.display_sentence),
    final_status: output.final_status,
    reason: normalizeString(output.reason),
    selected_mode: output.selected_mode,
    selected_sentence_id: normalizeSelectedSentenceId(output.selected_sentence_id),
    sentence_role: output.sentence_role,
    stance_action: normalizeNullableString(output.stance_action),
    stance_clarity: output.stance_clarity,
    subject_clarity: output.subject_clarity,
    target_subject: normalizeNullableString(output.target_subject),
    topic_label: normalizeNullableString(output.topic_label),
  };
}

function normalizeSelectedSentenceId(value: string | null) {
  return value?.match(/[TLB]\d+/i)?.[0].toUpperCase() ?? null;
}

function normalizeSourceIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeSelectedSentenceId(String(item)))
    .filter((item): item is string => Boolean(item));
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
  return readResponsesOutputText(payload);
}
