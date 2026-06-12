import "server-only";

import { getReasoningRequestOptions } from "@/lib/llm/structured-event-config";
import {
  parseResponsesJsonObject,
  readResponsesOutputText,
} from "@/lib/llm/responses-output";
import {
  getStatementEvalDefaultReasoningEffort,
  getStatementEvalMaxOutputTokens,
  getStatementEvalModel,
} from "./config";
import { buildStatementEvalPlannerPrompt } from "./prompts";
import { STATEMENT_EVAL_PLANNER_SCHEMA } from "./schemas";
import { estimateLlmTokens } from "./token-estimate";
import type {
  StatementEvalCandidate,
  StatementEvalPlannerOutput,
  StatementEvalSourceRow,
  StatementEvalVariant,
} from "./types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const REASONING_EFFORT_ENV_KEY = "OPENAI_STATEMENT_EVAL_REASONING_EFFORT";

export async function planStatementEvalSpansWithLlm({
  candidates,
  row,
  variant,
}: {
  candidates: StatementEvalCandidate[];
  row: StatementEvalSourceRow;
  variant: StatementEvalVariant;
}) {
  const model = getStatementEvalModel();
  const prompt = buildStatementEvalPlannerPrompt({ candidates, row, variant });
  const { output, outputText } =
    await requestStructuredOutput<StatementEvalPlannerOutput>({
      formatName: "statement_eval_span_plan",
      model,
      prompt,
      schema: STATEMENT_EVAL_PLANNER_SCHEMA,
    });
  const estimatedInputTokens = estimateLlmTokens(prompt);
  const estimatedOutputTokens = estimateLlmTokens(outputText);

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
    model,
    output: sanitizePlannerOutput(output),
    rawOutput: output,
    reasoningEffort:
      process.env[REASONING_EFFORT_ENV_KEY]?.trim() ||
      getStatementEvalDefaultReasoningEffort(),
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
}): Promise<{ output: T; outputText: string }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("missing_openai_api_key");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: prompt,
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: getStatementEvalMaxOutputTokens(),
      model,
      text: {
        format: {
          name: formatName,
          schema,
          strict: true,
          type: "json_schema",
        },
      },
      ...getReasoningRequestOptions(model, {
        defaultEffort: getStatementEvalDefaultReasoningEffort(),
        effortEnvKey: REASONING_EFFORT_ENV_KEY,
      }),
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(`openai_request_failed:${response.status}`);
  }

  const outputText = readResponsesOutputText(payload);

  if (!outputText) {
    throw new Error("empty_openai_output");
  }

  return {
    output: parseResponsesJsonObject<T>(outputText),
    outputText,
  };
}

function sanitizePlannerOutput(
  output: StatementEvalPlannerOutput,
): StatementEvalPlannerOutput {
  return {
    final_status: normalizeEnum(output.final_status, [
      "selected",
      "review_needed",
      "rejected",
      "failed",
    ]),
    issue_clarity: normalizeEnum(output.issue_clarity, [
      "clear",
      "implied",
      "missing",
    ]),
    reason: normalizeString(output.reason),
    role_tags: Array.isArray(output.role_tags)
      ? output.role_tags
          .map((tag) => ({
            candidate_id: normalizeString(tag.candidate_id),
            role: normalizeEnum(tag.role, [
              "issue",
              "stance",
              "combined",
              "context",
              "notice",
              "bad",
            ]),
          }))
          .filter((tag) => tag.candidate_id)
      : [],
    spans: Array.isArray(output.spans)
      ? output.spans
          .map((span) => ({
            candidate_id: normalizeString(span.candidate_id),
            role: normalizeEnum(span.role, ["issue", "stance", "combined"]),
            text: normalizeString(span.text),
          }))
          .filter((span) => span.candidate_id)
      : [],
    stance_clarity: normalizeEnum(output.stance_clarity, [
      "clear",
      "weak",
      "missing",
    ]),
    summary_mode: normalizeEnum(output.summary_mode, [
      "single_span",
      "issue_plus_stance",
      "two_sentence",
    ]),
  };
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEnum<T extends string>(value: unknown, values: T[]) {
  return values.includes(value as T) ? (value as T) : values[0];
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
