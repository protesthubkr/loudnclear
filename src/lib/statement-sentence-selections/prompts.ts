import type {
  StatementSentenceSelectionCandidate,
  StatementSentenceSelectionRow,
} from "./types";

export function buildStatementSentenceSelectorPrompt({
  candidates,
  row,
}: {
  candidates: StatementSentenceSelectionCandidate[];
  row: StatementSentenceSelectionRow;
}) {
  return [
    "성명뭉에 노출할 핵심 문장 후보를 고른다.",
    "",
    "절대 규칙:",
    "- 새 문장을 만들거나 고쳐 쓰지 않는다.",
    "- 반드시 아래 candidate id 중 하나를 selected_sentence_id로 고른다.",
    "- 후보 중 적절한 문장이 없으면 is_target_document=false, selected_sentence_id=null, displayable=false로 답한다.",
    "- 제목 후보도 원문 후보로 인정한다. 제목 안에 더 강한 요구/비판/판단 문장이 있으면 본문 첫 문장보다 제목 후보를 우선한다.",
    "- 단순 배경 설명, 행사 개최, 자료/월간지/영상/카드뉴스 소개, 날짜/장소/문의 안내, 인물 발언 소개만 담긴 문장은 고르지 않는다.",
    "- '개인정보가 유출되었습니다', '토론회를 공동주최했습니다', '기자회견을 열었습니다', '자료집을 발간했습니다'처럼 사건/활동 사실만 말하는 문장은 그 자체에 요구나 판단이 없으면 고르지 않는다.",
    "- 단체명, 직책, 사람 이름만 남은 바이라인 문장은 절대 고르지 않는다.",
    "- 쉼표로 끝나거나 '하며/하고/는데/위해/관련해'처럼 뒤 문장이 필요한 조각은 절대 고르지 않는다.",
    "- 가장 좋은 문장은 무엇에 대한 입장인지와 단체의 판단/요구/비판/환영/우려가 함께 드러나는 문장이다.",
    "- 강한 단어 하나만 있는 짧은 구호보다, 소재와 입장이 같이 담긴 문장을 우선한다.",
    "- 다만 소재와 입장이 함께 담긴 후보가 없다면, 단독 노출 시 의미가 통하는 요구/비판/우려 문장을 고르고 reason에 근거를 적는다.",
    "- 성명뭉 첫 화면에 단독으로 보여도 의미가 통하는 문장만 displayable=true로 둔다.",
    "",
    "sentence_role 기준:",
    "- demand: 촉구/요구/사과/철회/중단/사퇴 등 직접 요구",
    "- condemnation: 규탄/고발/엄단/책임 추궁",
    "- criticism: 비판/문제 제기/정치적 판단",
    "- welcome: 환영/지지",
    "- concern: 우려/경고",
    "- pledge: 다짐/연대/싸우겠다는 의지",
    "- context: 사건 설명이나 배경 설명",
    "- notice: 행사/토론회/집회/기자회견/일정/신청 안내",
    "- tribute: 추모/기념/애도 중심",
    "- resource_intro: 자료/영상/카드뉴스/월간지/보고서 소개",
    "",
    `단체명: ${row.organizationName}`,
    `출처 유형: ${row.sourceType}`,
    `문서 유형 힌트: ${row.documentType}`,
    `출처 URL: ${row.sourceUrl}`,
    row.title ? `제목: ${row.title}` : "",
    "",
    "후보 문장:",
    ...candidates.map(
      (candidate) =>
        `[${candidate.id}] (${candidate.section}) ${candidate.text}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStatementSentenceVerifierPrompt({
  candidate,
  row,
}: {
  candidate: StatementSentenceSelectionCandidate;
  row: StatementSentenceSelectionRow;
}) {
  return [
    "성명뭉 노출 적합성 검증자다.",
    "",
    "아래 선택 문장이 성명뭉 첫 화면에 핵심 문장으로 노출되어도 되는지 판정한다.",
    "문장을 새로 쓰거나 보완하지 말고, 선택 문장 자체만 평가한다.",
    "선택 문장이 구체적 소재와 단체의 판단/요구/비판/환영/우려를 담고 있으면 displayable=true로 답한다.",
    "displayable=true라고 판단했다면 reason도 노출 가능하다는 판단과 일관되어야 한다.",
    "displayable=false라고 판단했다면 reason에 왜 노출 불가인지 명확히 적고, 노출 가능하다는 표현을 쓰지 않는다.",
    "",
    "displayable=false는 아래 중 하나에 명확히 해당할 때만 사용한다:",
    "- 단순 배경 설명이다.",
    "- 행사/토론회/기자회견/자료/영상/월간지/카드뉴스 소개다.",
    "- 날짜/장소/문의/신청 등 안내 정보다.",
    "- 단체명, 직책, 사람 이름만 남은 바이라인이다.",
    "- 문장이 쉼표나 연결 어미로 끝나 단독 문장으로 완결되지 않는다.",
    "- 추모/기념/애도만 있고 구체적 입장 판단이 약하다.",
    "- 단독 노출 시 무엇에 대한 어떤 입장인지 모호하다.",
    "- 사건 발생 사실만 있고 단체의 판단/요구/비판/환영/우려가 없다.",
    "",
    "예시:",
    "- '정부는 도급노동자 최저임금 적용을 반드시 확정해야 합니다.' => displayable=true, sentence_role=demand",
    "- '전쟁기념관은 역사 왜곡 시도를 즉각 사과하십시오.' => displayable=true, sentence_role=demand",
    "- '솜방망이 처벌을 끝낼 때입니다.' => displayable=true, sentence_role=criticism",
    "- '티빙에서 1,300만명의 개인정보가 유출되었습니다.' => displayable=false, sentence_role=context",
    "- '선거운동 하면서 진짜 무슨 일이 있었는지,' => displayable=false, sentence_role=context",
    "- '토론회를 공동주최했습니다.' => displayable=false, sentence_role=notice",
    "- '오늘은 현충일입니다.' => displayable=false, sentence_role=tribute",
    "",
    `단체명: ${row.organizationName}`,
    `출처 유형: ${row.sourceType}`,
    `문서 유형 힌트: ${row.documentType}`,
    row.title ? `제목: ${row.title}` : "",
    "",
    `선택 문장 id: ${candidate.id}`,
    `선택 문장: ${candidate.text}`,
  ]
    .filter(Boolean)
    .join("\n");
}
