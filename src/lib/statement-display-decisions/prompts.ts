import { getStatementDisplayDecisionContextChars } from "./config";
import type {
  StatementDisplayCandidate,
  StatementDisplaySourceRow,
} from "./types";

export function buildStatementDisplayDecisionPrompt({
  candidates,
  row,
}: {
  candidates: StatementDisplayCandidate[];
  row: StatementDisplaySourceRow;
}) {
  return [
    "당신은 성명뭉 피드에 노출할 최종 문장을 고르는 편집 judge다.",
    "",
    "목표:",
    "- 사용자가 한 문장 또는 두 문장만 보고도 무엇에 대한 성명/논평/입장인지 알 수 있어야 한다.",
    "- 단체의 판단, 요구, 비판, 환영, 우려, 다짐, 감상, 태도 중 하나 이상이 드러나야 한다.",
    "- 원문에 없는 사실, 표현, 연결어, 요약문을 새로 만들지 않는다. 후보 문장 또는 원문 스냅샷에 실제로 있는 연속 span만 고르고 조합한다.",
    "",
    "반드시 A/C 후보를 먼저 만든다:",
    "- A 후보: 제목 또는 전반부 리드가 사안과 입장을 충분히 담는 경우의 제목/리드 기반 후보.",
    "- C 후보: 제목이 표어, 대변인 제목, 결론, 정치적 수사, 메타데이터에 가깝거나 맥락이 부족할 때의 본문 conservative 후보.",
    "- A와 C는 각각 1~2문장이어야 하며, 후보 목록을 사용했다면 source_ids에는 사용한 후보 id를 순서대로 적는다.",
    "- 후보 목록이 부족하면 원문 스냅샷에서 직접 연속 span을 골라도 된다. 이때 source_ids는 []로 둔다.",
    "- 후보가 부적절하면 sentence=null, source_ids=[]로 둔다.",
    "",
    "사용자 기준을 차용한 judge 규칙:",
    "1. 제목/리드가 사안과 입장을 함께 담고 단독 피드 문장으로 읽히면 A를 선호한다.",
    "2. 제목이 길다는 이유만으로 감점하지 않는다. 긴 제목이라도 사안 anchor와 stance anchor가 있으면 좋은 A 후보가 될 수 있다.",
    "3. 제목이 단체명, 문서유형, 대변인명, 부제 기호 때문에 긴 경우에는 그 메타데이터를 제거한 뒤 판단한다.",
    "4. 제목이 표어/결론만 있고 무엇에 대한 입장인지 약하면 C를 선호한다.",
    "5. 본문 후보가 사안의 맥락과 단체의 판단을 더 잘 드러내면 C를 선호한다.",
    "6. 제목/리드가 사안 설명을 충분히 포함하지 않아도, 요구 대상이 구체적이고 단호한 요구가 담겨 있으면 좋은 후보로 인정한다.",
    "7. stance 판단은 단어 매칭이 아니라 맥락으로 한다. '하라', '하십시오', '제안한다', '끝낼 때입니다', '지키겠습니다', '정면 도전입니다' 같은 표현은 맥락상 stance가 될 수 있다.",
    "7-1. 추모/애도 문장은 공식 문건에서 단체가 표명하는 정치적·사회적 입장이다. '명복을 빕니다', '기억하겠습니다'처럼 추모 자체만 담긴 문장도 좋은 후보가 될 수 있다.",
    "8. [성명], [논평], [보도자료], [이주희 원내대변인], <소식> 같은 형식 잔여물은 최종 후처리 대상이다. 내용이 좋다면 이 형식 문제만으로 버리지 않는다.",
    "9. 다만 후처리 후에도 문장 의미가 깨지거나 원문에 없는 말이 생기면 review_needed로 둔다.",
    "10. 두 문장을 합칠 때 각 문장이 자연스럽게 끝나야 한다. 마침표 없이 이어붙이지 않는다.",
    "",
    "출력 필드:",
    "- candidate_a_sentence: A 후보 문장. 없으면 null.",
    "- candidate_a_source_ids: A 후보를 구성한 후보 id 배열.",
    "- candidate_c_sentence: C 후보 문장. 없으면 null.",
    "- candidate_c_source_ids: C 후보를 구성한 후보 id 배열.",
    "- chosen_candidate: A | C | none.",
    "- final_status: selected | review_needed | rejected.",
    "- selected_mode: selected이면 sentence_only 또는 label_plus_sentence. review_needed/rejected이면 같은 이름으로 둔다.",
    "- selected_sentence_id: 최종 선택의 핵심 근거가 되는 후보 id. 원문 스냅샷 직접 span이면 null.",
    "- core_sentence: selected_sentence_id 후보의 원문 문장 또는 최종 선택의 핵심 원문 span.",
    "- topic_label: 보통 null. label_plus_sentence가 꼭 필요할 때만 원문에 근거한 짧은 소재명을 쓴다.",
    "- display_sentence: 최종 피드 문장. selected이면 필수.",
    "- target_subject: 무엇에 대한 입장인지.",
    "- stance_action: 단체의 판단/요구/태도.",
    "- sentence_role: demand | condemnation | criticism | welcome | concern | pledge | context | notice | tribute | resource_intro.",
    "- subject_clarity: clear | implied | missing.",
    "- stance_clarity: clear | weak | missing.",
    "- confidence: 0~100.",
    "- reason: A와 C 중 왜 선택했는지 짧게 설명.",
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
