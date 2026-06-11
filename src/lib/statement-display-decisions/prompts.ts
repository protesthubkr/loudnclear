import { getStatementDisplayDecisionContextChars } from "./config";
import type {
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionRow,
} from "./types";

export function buildStatementDisplayDecisionPrompt({
  candidates,
  row,
}: {
  candidates: StatementSentenceSelectionCandidate[];
  row: StatementSentenceSelectionRow;
}) {
  return [
    "당신은 '성명뭉' 피드의 최종 노출문을 결정하는 편집자다.",
    "",
    "목표:",
    "- 피드 사용자가 말풍선 한 개만 보고도 '무슨 소재에 대한 어떤 입장/요구/비판인지' 알 수 있게 한다.",
    "- 기존 핵심 문장 하나를 무조건 고집하지 않는다.",
    "- 문장 단독이 충분한지, 짧은 소재 라벨을 붙인 쪽이 더 좋은지 반드시 비교한다.",
    "",
    "입력:",
    "- 후보 문장들은 원문에서 기계적으로 잘라낸 문장이다.",
    "- current_core_sentence는 기존 노출 문장일 뿐이며 정답이 아니다.",
    "- title과 text_snapshot은 후보 판단을 위한 근거다.",
    "",
    "판단 규칙:",
    "1. 성명/논평/입장/기자회견/보도자료처럼 공적 판단이나 요구가 있는 글만 selected가 될 수 있다.",
    "2. 단순 일정 공지, 자료집 소개, 링크 안내, 내부 행사 홍보, 추모문처럼 현재 쟁점에 대한 판단/요구가 약한 글은 rejected 또는 review_needed로 둔다.",
    "3. 정당 논평의 제목형 문장도 소재와 입장이 명확하면 후보로 허용한다.",
    "4. 후보 문장의 일부를 새로 잘라내거나 다시 쓰지 않는다. core_sentence는 반드시 선택한 후보 문장과 정확히 같아야 한다.",
    "5. selected_mode가 sentence_only이면 display_sentence도 선택한 후보 문장과 정확히 같아야 한다.",
    "6. selected_mode가 label_plus_sentence이면 topic_label은 title, 후보 문장, 원문에 근거한 6~24자 안팎의 한국어 소재 라벨이어야 한다.",
    "7. label_plus_sentence는 후보 문장 자체의 입장/요구는 좋지만 소재가 생략되어 애매할 때만 쓴다.",
    "8. label_plus_sentence의 display_sentence는 '소재 라벨, 후보 문장' 형태로 만든다. 라벨은 단체명이나 문서유형명이 아니라 소재여야 한다.",
    "9. title의 '[녹색당 성명]', '[대변인 논평]' 같은 말머리, 작성자명, 직함은 topic_label이나 display_sentence에 넣지 않는다.",
    "10. subject_clarity와 stance_clarity 둘 중 하나라도 missing이면 selected가 아니라 review_needed 또는 rejected다.",
    "11. 후보가 너무 장황해도 임의 요약하지 않는다. 더 좋은 짧은 후보가 있으면 그 후보를 고른다.",
    "",
    "비교 절차:",
    "- 먼저 원문 전체 맥락에서 실제 소재와 단체의 판단/요구를 파악한다.",
    "- 후보 중 소재와 판단이 가장 잘 드러나는 문장을 찾는다.",
    "- sentence_only와 label_plus_sentence를 비교해 피드 노출 품질이 더 좋은 쪽을 고른다.",
    "- 둘 다 피드 문장으로 부적절하면 review_needed 또는 rejected를 선택한다.",
    "",
    "출력 필드:",
    "- final_status: selected | review_needed | rejected",
    "- selected_mode: sentence_only | label_plus_sentence | review_needed | rejected",
    "- selected_sentence_id: 선택한 후보 id. rejected이면 null 가능",
    "- core_sentence: 선택한 후보 문장. rejected이면 null 가능",
    "- topic_label: label_plus_sentence일 때만 필수. 그 외에는 null",
    "- display_sentence: 최종 피드 노출문. selected일 때 필수",
    "- target_subject: 무엇에 대한 입장인지",
    "- stance_action: 요구/비판/환영/우려/촉구 등 핵심 태도",
    "- sentence_role: demand | condemnation | criticism | welcome | concern | pledge | context | notice | tribute | resource_intro",
    "- subject_clarity: clear | implied | missing",
    "- stance_clarity: clear | weak | missing",
    "- confidence: 0~100",
    "- reason: 짧은 한국어 판단 이유",
    "",
    "문서 메타:",
    JSON.stringify(
      {
        current_core_sentence: row.currentCoreSentence,
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
    "후보 문장:",
    JSON.stringify(candidates, null, 2),
    "",
    "원문 스냅샷:",
    truncateContext(row.textSnapshot),
  ].join("\n");
}

function truncateContext(text: string) {
  const maxChars = getStatementDisplayDecisionContextChars();

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars).trimEnd()}\n\n[truncated]`;
}
