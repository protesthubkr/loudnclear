import type { TelegramStatementDocumentType } from "./types";
import { buildStatementExtractionCandidates } from "./extraction-candidates";

export type TelegramStatementSentenceExtractionInput = {
  documentTypeHint: TelegramStatementDocumentType;
  extractionGuidance?: "people_power_strong_expression";
  organizationName: string;
  sourceUrl: string;
  textSnapshot: string;
};

export function buildTelegramStatementExtractionPrompt(
  input: TelegramStatementSentenceExtractionInput,
) {
  const candidates = buildStatementExtractionCandidates(input.textSnapshot);

  return [
    "아래 텔레그램 메시지가 단체의 성명, 논평, 입장문, 브리핑, 기자회견문, 보도자료, 규탄문, 환영문 등 입장이 정해진 문건인지 판단한다.",
    "문건이 맞다면 핵심 입장을 가장 잘 드러내는 원문 문장 하나를 고른다.",
    "동시에 그 문장이 성명뭉 첫 화면에 단독으로 노출되어도 되는지 displayable로 판정한다.",
    "",
    "절대 규칙:",
    "- displayable=true이면 반드시 아래 후보 문장 id 중 하나를 selected_candidate_id로 고른다.",
    "- selected_candidate_id로 고른 후보 문장을 core_sentence에 그대로 복사한다.",
    "- core_sentence는 메시지 원문에 실제로 존재하는 연속된 문자열이어야 한다.",
    "- 문장을 새로 쓰거나 요약하거나 어미, 조사, 띄어쓰기, 문장부호를 바꾸지 않는다.",
    "- displayable=false이면 selected_candidate_id=null, core_sentence=\"\"로 답한다.",
    "- core_sentence 자체에 target_subject와 stance_action이 모두 들어 있어야 한다. 다른 문장에 있는 판단/요구를 빌려 displayable=true로 판단하지 않는다.",
    "- 원문 전체가 여러 문장으로 이루어진 것은 displayable=false 사유가 아니다. 선택한 core_sentence 한 문장만 단독으로 완결되고 노출 가능하면 displayable=true다.",
    "- sentence_role이 context, notice, tribute, resource_intro이면 반드시 displayable=false, core_sentence=\"\"로 답한다.",
    "- 원문 전체에서 displayable=true 후보를 먼저 모두 찾는다. 하나라도 있으면 반드시 그중 가장 좋은 원문 문장을 core_sentence로 고르고, is_target_document=true로 답한다.",
    "- displayable=false는 원문 전체에 노출 가능한 후보 문장이 하나도 없을 때만 사용한다.",
    "- 규탄, 촉구, 요구 같은 강한 단어 하나에만 끌리지 않는다.",
    "- 무엇에 대한 성명/논평/입장인지가 중요하다. 제목, 부제, 전반부 리드 문장이 대상 소재와 단체의 판단을 함께 담고 있고 완결된 문장이라면 우선 검토한다.",
    "- 성명문과 논평문은 보통 전반부에 핵심 소재와 판단이 들어간다. 먼저 부제, 첫 문단, 인용문 직후의 리드 문장을 검토한다.",
    "- 단체의 요구, 규탄, 환영, 반대, 촉구, 비판, 우려, 연대, 제안, 판단이 드러나는 문장을 고른다.",
    "- 요구 문장만 대상이 아니다. 성명/논평/입장 라벨이 있는 글에서 부제나 리드 문장이 단체의 판단, 비판, 우려, 연대, 다짐을 선명하게 담으면 displayable=true로 볼 수 있다.",
    "- 제목이나 부제를 고를 때도 원문에 실제로 있는 연속 문자열을 그대로 복사한다. 숫자, 가운데점, 쉼표, 느낌표, 띄어쓰기 등을 임의로 바꾸지 않는다.",
    "- '[녹색당 성명]', '[논평]', '[보도자료]' 같은 문서 라벨은 핵심 입장이 아니다. 후보에 문서 라벨이 포함되어 있으면 라벨을 제외한 완결 문장을 고른다.",
    "- '여전히 타는 목마름으로, 정치장벽 너머 민주주의로!'처럼 구호형 제목이지만 누가 무엇을 하겠다는 판단/요구/다짐 동사가 없으면 고르지 않는다.",
    "- '6.10 민주항쟁 39주년, 민주주의를 향한 녹색정치의 부단한 싸움을 이어가겠습니다'처럼 소재와 다짐 동사가 함께 있는 부제는 좋은 핵심 문장 후보이다.",
    "- 제목 직후의 부제가 구체적 소재와 판단/요구/다짐 동사를 함께 담고 있으면, 뒤쪽 본문에서 같은 뜻을 반복하는 문장보다 그 부제를 우선한다.",
    "- 단체명은 organizationName으로 이미 제공된다. 후보 문장 안에 단체명이 없다는 이유만으로 제목 직후 부제보다 뒤쪽 본문 문장을 우선하지 않는다.",
    "- 후보 목록은 원문 순서이다. C1~C3 같은 앞쪽 후보가 완결된 판단/요구/다짐 문장이면, 같은 의미를 반복하는 뒤쪽 문장보다 앞쪽 후보를 우선한다.",
    "- 앞 문장이 배경 설명이고 뒤 문장에 직접 요구/규탄/비판이 있으면 뒤 문장을 우선한다.",
    "- 링크, 해시태그, 날짜, 장소, 참가 안내, 문의처, 서명부만 담긴 문장은 고르지 않는다.",
    "- 인물 이름과 직책만 있는 줄, 사회자/발언자 소개, 행사 순서, 내부 행동 지침은 핵심 문장으로 고르지 않는다.",
    "- '현장 스케치 영상을 공개합니다', '기자회견을 개최합니다', '보도자료: https://...'처럼 공개/개최/링크 안내만 담긴 문장은 핵심 문장이 아니다.",
    "- '토론회를 공동주최했습니다', '자료집을 발간했습니다', '버스를 타고 갑시다', '티셔츠 주문 바랍니다'처럼 활동/자료/참가 안내가 중심이면 displayable=false로 둔다.",
    "- 다만 캠페인, 행진, 결의대회 안내라도 원문 앞부분에 사회적 쟁점과 단체의 요구/비판/규탄이 명확히 제시되어 있으면 대상 문건이다. 이 경우 일정/참가신청/문의 부분은 무시하고 요구나 비판이 담긴 원문 문장을 고른다.",
    "- [취재요청], 취재요청서, 기자회견 안내 형식이어도 본문 안에 단체의 요구, 비판, 규탄, 촉구, 결의, 구호가 들어 있으면 추출 대상이다. 일정/장소/문의가 아니라 그 요구나 입장이 담긴 문장을 core_sentence로 고른다.",
    "- 활동 소식 문장이라도 '직접고용·원청교섭을 요구하며 3보 1배를 진행했다'처럼 구체적 요구와 행동이 함께 있으면 displayable=true로 둔다.",
    "- '개인정보가 유출되었습니다', '기자회견을 열었습니다'처럼 사건/활동 사실만 말하는 문장은 그 자체에 단체의 판단이나 요구가 없으면 displayable=false로 둔다.",
    "- 쉼표로 끝나거나 '하며/하고/는데/위해/관련해'처럼 뒤 문장이 필요한 조각은 displayable=false로 둔다.",
    "- 보도자료, 취재요청, 기자회견 안내라도 단체의 요구, 규탄, 촉구, 반대, 환영, 우려가 직접 드러나는 원문 문장이 없으면 대상 문건으로 보지 않는다.",
    "- 일일 뉴스 모음, 교육영상 안내, 선전전 일정, 여행/활동 일지는 대상 문건이 아니다.",
    "- 대상 문건이라고 확신할 수 없거나 핵심 입장 문장이 애매하면 반드시 is_target_document=false, core_sentence=\"\"로 답한다.",
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
    "displayable=true 조건:",
    "- 구체적 소재(target_subject)와 단체의 판단/요구/비판/환영/우려/연대/제안(stance_action)이 함께 드러난다.",
    "- 첫 화면에 한 문장만 보여도 무엇에 대한 어떤 입장인지 이해된다.",
    "- 문장이 원문 안에서 완결되어 있고 링크/일정/문의 없이도 의미가 통한다.",
    "",
    "displayable=false 조건:",
    "- 단순 배경 설명, 행사 개최, 자료/영상 소개, 일정/신청/후원 안내, 인물 발언 소개, 추모/기념만 있는 문장이다.",
    "- 단체의 판단이나 요구가 없거나, 무엇에 대한 입장인지 단독으로 모호하다.",
    "",
    "confidence 기준:",
    "- displayable=true이고 target_subject와 stance_action이 선명하면 85~98.",
    "- displayable=true이지만 문맥 의존성이 조금 있거나 표현이 약하면 70~84.",
    "- displayable=false이면 0~60.",
    "- confidence는 반드시 위 기준에 맞는 정수로 답한다.",
    "",
    "예시:",
    "- '택시노동자들은 수십 년 동안 장시간 노동과 저임금, 그리고 간주근로제라는 이름의 공짜노동을 감내해 왔습니다.' => displayable=false, sentence_role=context",
    "- '우리는 고공농성 투쟁의 승리와 택시 완전월급제 시행, 간주근로제 폐기를 요구하며 인천에서 국회, 그리고 청와대 사랑채까지 함께 걸으려 합니다.' => displayable=true, sentence_role=demand",
    "- 위 요구 문장 뒤에 행사 일정, 참가신청 링크, 문의처가 붙어 있어도 core_sentence는 요구 문장으로 고르고 displayable=true로 둔다.",
    "- '사용자 측이 금속산업 최저임금과 정년연장은 외면한 채 노사단체 참여 거버넌스 구축 조항을 삭제한 2차 제시안을 그대로 고수했습니다.' => displayable=true, sentence_role=criticism",
    "- '공공운수노조 신용보증재단 고객센터지부는 1일 오후 1시, 오세훈 시장 후보 선거캠프부터 정오호 시장 후보 캠프까지 직접고용·원청교섭을 요구하며 3보 1배를 진행했다.' => displayable=true, sentence_role=demand",
    "- '6·10 민주항쟁 39주년, 민주주의의 길에서 시민들과 함께하겠습니다' => displayable=true, sentence_role=pledge",
    "- '여전히 타는 목마름으로, 정치장벽 너머 민주주의로!' => displayable=false, sentence_role=context",
    "- '오늘 오전 기자회견을 열었습니다.' => displayable=false, sentence_role=notice",
    ...getAdditionalExtractionRules(input),
    "",
    `단체명: ${input.organizationName}`,
    `문서 유형 힌트: ${input.documentTypeHint}`,
    `원문 URL: ${input.sourceUrl}`,
    "",
    "후보 문장:",
    ...candidates.map((candidate) => `[${candidate.id}] ${candidate.text}`),
    "",
    "메시지 원문:",
    input.textSnapshot,
  ].join("\n");
}

function getAdditionalExtractionRules(
  input: TelegramStatementSentenceExtractionInput,
) {
  if (input.extractionGuidance !== "people_power_strong_expression") {
    return [] as string[];
  }

  return [
    "",
    "국민의힘 문서 추가 규칙:",
    "- 위 절대 규칙을 모두 지키되, 핵심 문장 후보가 여러 개라면 더 강한 판단, 비판, 규탄, 촉구, 요구가 직접 드러나는 문장을 우선한다.",
    "- 제목이나 리드 문장이 중립적인 사건 설명에 가깝고, 본문에 더 선명한 책임 추궁, 비판, 경고, 촉구, 요구 문장이 있으면 그 문장을 우선한다.",
    "- 강한 단어만 있는 짧은 조각이나 구호는 고르지 않는다. 대상과 판단/요구가 함께 남아 독립적으로 읽히는 원문 연속 문자열이어야 한다.",
    "- 국민의힘 대변인, 수석대변인, 원내수석대변인, 공보단장 이름만 있는 작성자/서명 줄은 절대 core_sentence로 고르지 않는다.",
    "- 대표적인 우선 신호는 규탄, 촉구, 요구, 책임, 즉각, 철회, 중단, 사과, 엄정, 강력, 분명히 같은 표현이다.",
  ];
}
