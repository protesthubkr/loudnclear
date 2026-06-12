import type { StatementEvalVariant, StatementEvalVariantKey } from "./types";

export const STATEMENT_EVAL_VARIANTS: StatementEvalVariant[] = [
  {
    description:
      "Prefer one existing span that already contains both issue and stance.",
    key: "conservative_single_span",
    promptFocus: [
      "가장 보수적인 방식이다.",
      "한 후보 안에 사안과 판단/요구/태도가 모두 있으면 그 후보의 연속 span 하나만 고른다.",
      "제목과 본문을 억지로 조합하지 않는다.",
      "문장이 조금 길어도 독립적으로 뜻이 가장 선명한 span을 우선한다.",
    ],
    version: "statement_eval_conservative_single_span_v1",
  },
  {
    description:
      "Use title for issue clarity and body for stance when that is better.",
    key: "title_issue_body_stance",
    promptFocus: [
      "제목이 사안을 잘 드러내고 본문이 판단/요구/태도를 잘 드러내면 둘을 조합한다.",
      "제목에서 문서 라벨, 대변인명, 단체명 반복은 고르지 않는다.",
      "본문 요구문이 짧아도 제목 조각과 함께 보면 의미가 분명하면 선택한다.",
      "제목만으로 태도가 약하면 반드시 본문 stance span을 함께 고른다.",
    ],
    version: "statement_eval_title_issue_body_stance_v1",
  },
  {
    description:
      "Tag candidate roles first, then choose the best issue and stance spans.",
    key: "role_tag_then_span",
    promptFocus: [
      "먼저 후보들을 issue, stance, combined, context, notice, bad로 분류한다고 생각한다.",
      "context나 notice만 있는 후보는 최종 span으로 고르지 않는다.",
      "issue 후보와 stance 후보가 분리되어 있으면 각각 하나씩 고른다.",
      "combined 후보가 가장 좋으면 single_span으로 둔다.",
    ],
    version: "statement_eval_role_tag_then_span_v1",
  },
  {
    description:
      "Aggressively use clause-level spans to reduce long event-heavy sentences.",
    key: "clause_level_strict",
    promptFocus: [
      "긴 문장의 행사 설명, 장소, 발언자, 기자회견 개최 정보는 피한다.",
      "긴 후보 안에서 사안과 요구가 들어간 가장 짧은 연속 span을 고른다.",
      "너무 짧아져 사안이 사라지면 제목 issue span을 함께 고른다.",
      "문맥상 잘라내면 오해가 생기는 span은 선택하지 않는다.",
    ],
    version: "statement_eval_clause_level_strict_v1",
  },
];

export function getStatementEvalVariants(keys?: StatementEvalVariantKey[]) {
  if (!keys?.length) {
    return STATEMENT_EVAL_VARIANTS;
  }

  const selected = new Set(keys);

  return STATEMENT_EVAL_VARIANTS.filter((variant) => selected.has(variant.key));
}

export function isStatementEvalVariantKey(
  value: string,
): value is StatementEvalVariantKey {
  return STATEMENT_EVAL_VARIANTS.some((variant) => variant.key === value);
}
