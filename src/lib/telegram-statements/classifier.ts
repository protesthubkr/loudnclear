import type { TelegramChannelMessage } from "@/lib/telegram/channel-page";
import type {
  TelegramStatementCandidate,
  TelegramStatementDocumentType,
} from "./types";
import { hasDirectStatementStance } from "@/lib/statement-quality/extraction-quality";

const DOCUMENT_PATTERNS: Array<{
  documentType: TelegramStatementDocumentType;
  pattern: RegExp;
  reason: string;
}> = [
  { documentType: "commentary", pattern: /논평|논평문/, reason: "keyword:commentary" },
  { documentType: "statement", pattern: /성명|성명서/, reason: "keyword:statement" },
  { documentType: "position", pattern: /입장문|공식\s*입장|입장을\s*밝힌다/, reason: "keyword:position" },
  { documentType: "press_conference", pattern: /기자회견문|회견문/, reason: "keyword:press_conference" },
  { documentType: "press_release", pattern: /보도자료/, reason: "keyword:press_release" },
  { documentType: "condemnation", pattern: /규탄문|규탄\s*성명/, reason: "keyword:condemnation" },
  { documentType: "welcome", pattern: /환영문|환영\s*논평|환영\s*성명/, reason: "keyword:welcome" },
];

const STANCE_PATTERN =
  /(규탄한다|규탄합니다|촉구한다|촉구합니다|촉구하며|요구한다|요구합니다|요구하며|철회하라|철회하십시오|중단하라|중단돼야|사퇴하라|반대한다|반대합니다|환영한다|환영합니다|비판한다|비판합니다|우려한다|우려합니다|연대한다|연대합니다)/;

const LEAD_STANCE_NEWS_RE =
  /^(<소식>|\[소식\]|.*브리핑\b).{0,220}(규탄|촉구|요구|철회|반대|비판|우려|책임|교섭|개혁|보장|처벌|착수|마십시오)/;

const STANCE_SCAN_CHARS = 900;

const CAMPAIGN_TOPIC_RE =
  /(공짜노동|간주근로제|완전월급제|금속산업\s*최저임금|정년연장|노동인권|고용\s*보호|고용보장|총고용\s*보장|원청교섭|초기업[.\s·]*원청교섭|권리중심공공일자리|해고철회|장애인권리예산|탈시설\s*자립|활동지원서비스\s*24시간|신규\s*핵발전소|핵발전소|공공재생에너지|발전노동자|정의로운\s*전환)/;

const CAMPAIGN_ACTION_RE =
  /(요구|촉구|규탄|철회|폐기|중단|보장|쟁취|수용\s*불가|외면|왜곡|위협받고|기만|반대)/;

const DIGEST_RE = /민주노총\s*소식|📰.{0,80}📰|오피니언\s*📝/;

const EVENT_OR_PROGRAM_RE =
  /(교육영상|교안|교육담당자|교육참가자|수련회|참가자\s*모집|강좌|세미나|선전전|집담회|참가\s*신청|공동주최\s*신청|일시\s*[|:：]|장소\s*[|:：]|생중계|내일은\s*뭐하나요|특사단\s*\[\d+일차\])/;

const REPORTED_INTERVIEW_RE =
  /(후보는|대표는|위원장은|지부장은).{0,180}(말했다|밝혔다|토로했다|전했다|설명했다|성찰)/;

const WEAK_NOTICE_PATTERN =
  /(참가\s*신청|참가자\s*모집|신청\s*링크|후원\s*계좌|문의\s*:|장소\s*:|일시\s*:|시간\s*:)/;

const NON_STATEMENT_NOTICE_RE =
  /(주간\s*일정|일정\s*안내|좌담회.{0,80}개최|토론회.{0,80}개최|간담회.{0,80}개최|^\[교육지\]|교육지\s*내려받기|티셔츠.{0,80}(제작|주문)|주문\s*방법|참가버스|버스탑승\s*신청|대행진에\s*함께\s*갑시다|함께\s*버스를\s*타고|농성장\s*뉴스레터|서울시의원\s*후보|후원금\s*영수증|후원안내|조상지\s*후원회)/;
const NOTICE_DOCUMENT_TYPES = new Set<TelegramStatementDocumentType>([
  "press_conference",
  "press_release",
]);

export function classifyTelegramStatementMessage(
  message: TelegramChannelMessage,
): TelegramStatementCandidate | null {
  const text = normalizeSourceText(message.text);

  if (!text) {
    return null;
  }

  const detected = DOCUMENT_PATTERNS.find(({ pattern }) => pattern.test(text));

  if (detected) {
    if (
      NOTICE_DOCUMENT_TYPES.has(detected.documentType) &&
      !hasDirectStatementStance(text)
    ) {
      return null;
    }

    return {
      detectionReason: [detected.reason],
      documentType: detected.documentType,
      message,
    };
  }

  const leadText = text.slice(0, 320);
  const stanceText = text.slice(0, STANCE_SCAN_CHARS);

  if (looksLikeNonStatementNotice(leadText, stanceText)) {
    return null;
  }

  if (
    LEAD_STANCE_NEWS_RE.test(leadText) &&
    !looksLikeDigestOrProgram(leadText)
  ) {
    return {
      detectionReason: ["lead:stance_news"],
      documentType: "position",
      message,
    };
  }

  if (
    (
      STANCE_PATTERN.test(stanceText) ||
      hasDirectStatementStance(stanceText) ||
      hasSubstantiveCampaignStance(stanceText)
    ) &&
    !looksLikeDigestOrProgram(leadText) &&
    !looksLikeReportedInterview(leadText) &&
    !looksLikeOnlyEventNotice(leadText, stanceText)
  ) {
    return {
      detectionReason: ["stance:lead_sentence"],
      documentType: "position",
      message,
    };
  }

  return null;
}

export function classifyTelegramStatementMessages(
  messages: TelegramChannelMessage[],
) {
  return messages.flatMap((message) => {
    const candidate = classifyTelegramStatementMessage(message);
    return candidate ? [candidate] : [];
  });
}

function looksLikeDigestOrProgram(text: string) {
  return DIGEST_RE.test(text) || EVENT_OR_PROGRAM_RE.test(text);
}

function looksLikeReportedInterview(text: string) {
  return REPORTED_INTERVIEW_RE.test(text);
}

function looksLikeNonStatementNotice(leadText: string, stanceText: string) {
  return NON_STATEMENT_NOTICE_RE.test(`${leadText} ${stanceText}`);
}

function looksLikeOnlyEventNotice(leadText: string, stanceText: string) {
  return (
    WEAK_NOTICE_PATTERN.test(leadText) &&
    !STANCE_PATTERN.test(stanceText) &&
    !hasSubstantiveCampaignStance(stanceText)
  );
}

function hasSubstantiveCampaignStance(text: string) {
  return (
    CAMPAIGN_TOPIC_RE.test(text) &&
    CAMPAIGN_ACTION_RE.test(text) &&
    countSentenceEndings(text) >= 2
  );
}

function normalizeSourceText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function countSentenceEndings(text: string) {
  return (text.match(/(?:다|요|까|라|니다|했다|합니다|습니다)[.!?。！？]?/g) ?? [])
    .length;
}
