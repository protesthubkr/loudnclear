import type {
  StatementEvalCandidate,
  StatementEvalSourceRow,
  StatementEvalVariant,
} from "./types";

export function buildStatementEvalPlannerPrompt({
  candidates,
  row,
  variant,
}: {
  candidates: StatementEvalCandidate[];
  row: StatementEvalSourceRow;
  variant: StatementEvalVariant;
}) {
  return [
    "너는 성명뭉 문장 실험실의 extractive span planner다.",
    "",
    "최종 목표:",
    "- 피드 사용자가 한눈에 무슨 사안인지 알 수 있어야 한다.",
    "- 단체의 판단, 요구, 입장, 감상, 태도 중 하나 이상이 드러나야 한다.",
    "- 결과는 1~2문장 분량이어야 한다.",
    "",
    "절대 규칙:",
    "- 새 문장, 새 단어, 새 조사, 새 연결어를 만들 수 없다.",
    "- 아래 후보 안에 실제로 존재하는 연속 문자열 span만 선택한다.",
    "- 출력의 spans[].text는 반드시 해당 candidate_id 후보 텍스트의 정확한 substring이어야 한다.",
    "- 제목을 사용해도 된다. 제목은 사안을 드러내는 데 특히 유용하다.",
    "- 대변인명, 작성자명, 문서 라벨, URL, 해시태그, 문의처, 일정 안내만 담긴 span은 피한다.",
    "- 사안이나 태도가 빠지면 selected가 아니라 review_needed 또는 rejected다.",
    "",
    "summary_mode 기준:",
    "- single_span: 한 span에 사안과 태도가 모두 들어 있다.",
    "- issue_plus_stance: 제목/본문의 issue span과 본문의 stance span을 조합해야 가장 좋다.",
    "- two_sentence: 서로 다른 두 span을 2문장처럼 함께 보여주는 편이 가장 좋다.",
    "",
    "variant focus:",
    ...variant.promptFocus.map((rule) => `- ${rule}`),
    "",
    "문서 메타:",
    JSON.stringify(
      {
        document_type: row.documentType,
        organization_name: row.organizationName,
        source_key: row.sourceKey,
        source_type: row.sourceType,
        source_url: row.sourceUrl,
        title: row.title,
      },
      null,
      2,
    ),
    "",
    "현재 운영 문장은 참고용 baseline일 뿐이며 선택 후보가 아니다:",
    JSON.stringify(
      {
        current_core_sentence: row.currentCoreSentence,
        current_display_sentence: row.currentDisplaySentence,
      },
      null,
      2,
    ),
    "",
    "후보 목록:",
    JSON.stringify(
      candidates.map((candidate) => ({
        id: candidate.id,
        issue_signal_count: candidate.issueSignalCount,
        kind: candidate.kind,
        source: candidate.source,
        stance_signal_count: candidate.stanceSignalCount,
        text: candidate.text,
      })),
      null,
      2,
    ),
    "",
    "출력 지침:",
    "- final_status가 selected이면 spans는 1~2개여야 한다.",
    "- issue_clarity와 stance_clarity를 각각 판단한다.",
    "- role_tags에는 최종 판단에 중요했던 후보들의 역할만 적는다.",
    "- reason에는 왜 이 조합이 최선인지 짧게 적는다.",
  ].join("\n");
}
