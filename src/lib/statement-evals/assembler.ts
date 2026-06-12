import {
  countIssueSignals,
  countStanceSignals,
  hasMetadataLeft,
  isLengthOk,
  normalizeSpaces,
} from "./signals";
import type {
  StatementEvalCandidate,
  StatementEvalOutputDecision,
  StatementEvalPlannerOutput,
  StatementEvalPlannedSpan,
  StatementEvalVariant,
} from "./types";

const LEADING_DOCUMENT_LABEL_RE =
  /^\s*(?:\[[^\]\n]{1,60}(?:성명|논평|브리핑|보도자료|기자회견|입장)[^\]\n]{0,30}\]\s*)+/;
const BRACKET_BYLINE_RE =
  /\s*\[[^\]\n]{1,50}(?:대변인|부대변인|수석대변인|공보단장|대표)[^\]\n]*\]\s*/g;
const TRAILING_BYLINE_RE =
  /\s*(?:[|｜-]\s*)?[가-힣]{2,5}\s*(?:대변인|부대변인|수석대변인|공보단장|대표)\s*$/;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const HASH_TAG_RE = /#[^\s#]+/g;
const BULLET_RE = /^\s*[>*\-–—•·●○■□▪▫]\s*/;

export function buildStatementEvalDecision({
  candidates,
  estimatedInputTokens = 0,
  estimatedOutputTokens = 0,
  estimatedTotalTokens = 0,
  model,
  output,
  rawOutput,
  reasoningEffort,
  variant,
}: {
  candidates: StatementEvalCandidate[];
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedTotalTokens?: number;
  model: string | null;
  output: StatementEvalPlannerOutput | null;
  rawOutput: unknown;
  reasoningEffort: string | null;
  variant: StatementEvalVariant;
}): StatementEvalOutputDecision {
  if (!output) {
    return failedDecision({
      candidates,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      failureReason: "empty_planner_output",
      model,
      rawOutput,
      reasoningEffort,
      variant,
    });
  }

  const spanResult = resolvePlannedSpans({
    candidates,
    spans: output.spans,
  });

  if (!spanResult.ok) {
    return failedDecision({
      candidates,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      failureReason: spanResult.failureReason,
      model,
      output,
      rawOutput,
      reasoningEffort,
      variant,
    });
  }

  const assembledSentence = assembleSpans(spanResult.spans);
  const cleansedSentence = cleanseEvalSentence(assembledSentence);
  const issueText = spanResult.spans
    .filter((span) => span.role === "issue" || span.role === "combined")
    .map((span) => span.text)
    .join(" ")
    .trim();
  const stanceText = spanResult.spans
    .filter((span) => span.role === "stance" || span.role === "combined")
    .map((span) => span.text)
    .join(" ")
    .trim();
  const issueSignalCount = countIssueSignals(cleansedSentence);
  const stanceSignalCount = countStanceSignals(cleansedSentence);
  const metadataLeft = hasMetadataLeft(cleansedSentence);
  const lengthOk = isLengthOk(cleansedSentence);
  const extractiveOk = true;
  const cleansingOk = !metadataLeft;
  const hardGateOk =
    output.final_status === "selected" &&
    extractiveOk &&
    cleansingOk &&
    lengthOk &&
    output.issue_clarity !== "missing" &&
    output.stance_clarity !== "missing" &&
    stanceSignalCount > 0;

  return {
    assembledSentence,
    candidateSnapshot: candidates,
    cleansedSentence,
    cleansingOk,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    extractiveOk,
    failureReason: hardGateOk ? null : getSoftFailureReason({
      lengthOk,
      metadataLeft,
      output,
      stanceSignalCount,
    }),
    finalStatus: hardGateOk ? "selected" : output.final_status,
    hardGateOk,
    issueClarity: output.issue_clarity,
    issueSignalCount,
    issueText: issueText || null,
    lengthOk,
    metadataLeft,
    model,
    plannerOutput: output,
    plannerReason: output.reason,
    rawPlannerOutput: rawOutput,
    reasoningEffort,
    spanPlan: spanResult.spans,
    stanceClarity: output.stance_clarity,
    stanceSignalCount,
    stanceText: stanceText || null,
    summaryMode: output.summary_mode,
    variant,
  };
}

export function cleanseEvalSentence(text: string) {
  return normalizeSpaces(
    text
      .replace(URL_RE, "")
      .replace(HASH_TAG_RE, "")
      .replace(BRACKET_BYLINE_RE, " ")
      .replace(LEADING_DOCUMENT_LABEL_RE, "")
      .replace(TRAILING_BYLINE_RE, "")
      .replace(BULLET_RE, "")
      .replace(/\s+([,.!?。！？])/g, "$1")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'"),
  );
}

function resolvePlannedSpans({
  candidates,
  spans,
}: {
  candidates: StatementEvalCandidate[];
  spans: StatementEvalPlannedSpan[];
}):
  | { ok: true; spans: StatementEvalPlannedSpan[] }
  | { failureReason: string; ok: false } {
  if (spans.length === 0 || spans.length > 2) {
    return { failureReason: "invalid_span_count", ok: false };
  }

  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const resolved: StatementEvalPlannedSpan[] = [];

  for (const span of spans) {
    const candidate = candidateMap.get(span.candidate_id);

    if (!candidate) {
      return { failureReason: `unknown_candidate:${span.candidate_id}`, ok: false };
    }

    const spanText = normalizeSpaces(span.text || candidate.text);

    if (!spanText || !candidate.text.includes(spanText)) {
      return {
        failureReason: `non_extractive_span:${span.candidate_id}`,
        ok: false,
      };
    }

    resolved.push({
      candidate_id: span.candidate_id,
      role: span.role,
      text: spanText,
    });
  }

  return { ok: true, spans: resolved };
}

function assembleSpans(spans: StatementEvalPlannedSpan[]) {
  const deduped: StatementEvalPlannedSpan[] = [];

  for (const span of spans) {
    if (deduped.some((item) => item.text.includes(span.text))) {
      continue;
    }

    deduped.push(span);
  }

  return normalizeSpaces(deduped.map((span) => span.text).join(" "));
}

function getSoftFailureReason({
  lengthOk,
  metadataLeft,
  output,
  stanceSignalCount,
}: {
  lengthOk: boolean;
  metadataLeft: boolean;
  output: StatementEvalPlannerOutput;
  stanceSignalCount: number;
}) {
  if (output.final_status !== "selected") {
    return `planner_${output.final_status}`;
  }

  if (output.issue_clarity === "missing") {
    return "missing_issue";
  }

  if (output.stance_clarity === "missing") {
    return "missing_stance";
  }

  if (metadataLeft) {
    return "metadata_left";
  }

  if (!lengthOk) {
    return "length_out_of_range";
  }

  if (stanceSignalCount === 0) {
    return "no_stance_signal";
  }

  return null;
}

function failedDecision({
  candidates,
  estimatedInputTokens = 0,
  estimatedOutputTokens = 0,
  estimatedTotalTokens = 0,
  failureReason,
  model,
  output = null,
  rawOutput,
  reasoningEffort,
  variant,
}: {
  candidates: StatementEvalCandidate[];
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedTotalTokens?: number;
  failureReason: string;
  model: string | null;
  output?: StatementEvalPlannerOutput | null;
  rawOutput: unknown;
  reasoningEffort: string | null;
  variant: StatementEvalVariant;
}): StatementEvalOutputDecision {
  return {
    assembledSentence: null,
    candidateSnapshot: candidates,
    cleansedSentence: null,
    cleansingOk: false,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    extractiveOk: false,
    failureReason,
    finalStatus: "failed",
    hardGateOk: false,
    issueClarity: output?.issue_clarity ?? null,
    issueSignalCount: 0,
    issueText: null,
    lengthOk: false,
    metadataLeft: false,
    model,
    plannerOutput: output,
    plannerReason: output?.reason ?? null,
    rawPlannerOutput: rawOutput,
    reasoningEffort,
    spanPlan: output?.spans ?? [],
    stanceClarity: output?.stance_clarity ?? null,
    stanceSignalCount: 0,
    stanceText: null,
    summaryMode: output?.summary_mode ?? null,
    variant,
  };
}
