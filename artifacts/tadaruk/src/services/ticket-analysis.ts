import {
  analyzeTicket as requestTicketAnalysis,
  type TicketAnalysis,
  type TicketAnalysisInput,
} from "@workspace/api-client-react";

export type TicketAnalysisLocale = "ar" | "en";

export type TicketAnalysisRequest = {
  description: string;
  location?: string;
  locale: TicketAnalysisLocale;
};

export interface TicketAnalysisAdapter {
  analyze(input: TicketAnalysisRequest): Promise<TicketAnalysis>;
}

type Scenario = {
  matches: RegExp;
  category: string;
  specialization: string;
  priority: TicketAnalysis["priority"];
  title: Record<TicketAnalysisLocale, string>;
};

const scenarios: Scenario[] = [
  {
    matches: /(?=.*(?:مكيف|المكيفات|التكييف|air\s*condition(?:er)?|ac\b))(?=.*(?:ما\s*يبرد|لا\s*يبرد|لا\s*يبرّد|ضعف\s*التبريد|لا\s*يعمل|ما\s*يشتغل|not\s*cooling|not\s*cold|not\s*working|warm\s*air))/iu,
    category: "cooling",
    specialization: "cooling",
    priority: "medium",
    title: { ar: "ضعف التبريد في المكيف", en: "Air conditioner not cooling" },
  },
  {
    matches: /(?=.*(?:ثلاجة|براد|refrigerator|fridge))(?=.*(?:حرارة|درجة|مرتفع|مرتفعة|high\s*temp|temperature|too\s*warm))/iu,
    category: "cooling",
    specialization: "cooling",
    priority: "high",
    title: { ar: "ارتفاع حرارة الثلاجة", en: "Refrigerator temperature is high" },
  },
  {
    matches: /(?=.*(?:تسرّب|تسرب|leak|leaking))(?=.*(?:ماء|مياه|water|sink|حوض|صنبور))/iu,
    category: "plumbing",
    specialization: "plumbing",
    priority: "high",
    title: { ar: "تسرب مياه", en: "Water leak" },
  },
  {
    matches: /(?=.*(?:إنارة|الإضاءة|ضوء|مصباح|لمبة|lighting|light|lamp))(?=.*(?:لا\s*يعمل|لا\s*تعمل|متعطّل|متوقف|مطفأ|flicker|not\s*working|out))/iu,
    category: "electrical",
    specialization: "electrical",
    priority: "medium",
    title: { ar: "عطل في الإنارة", en: "Lighting malfunction" },
  },
  {
    matches: /(?:شرر|شرارة|يصدر\s*شرر|sparking|sparks?|electrical\s*arc|smoke|fire|حريق|دخان|تسرب\s*غاز|gas\s*leak)/iu,
    category: "electrical",
    specialization: "electrical",
    priority: "urgent",
    title: { ar: "شرر كهربائي — يلزم فحص عاجل", en: "Electrical sparking — urgent inspection" },
  },
];

const locationTerms: Array<[string, string[]]> = [
  ["المطبخ", ["المطبخ", "مطبخ", "kitchen"]],
  ["منطقة العملاء", ["منطقة العملاء", "صالة العملاء", "صالة الجلوس", "customer area", "customer hall", "lobby", "dining area"]],
  ["المستودع", ["المستودع", "المخزن", "warehouse", "storage", "stockroom"]],
  ["دورات المياه", ["دورات المياه", "دورة المياه", "الحمام", "الحمامات", "restroom", "bathroom", "toilet"]],
  ["منطقة التحضير", ["منطقة التحضير", "حوض التحضير", "prep area", "preparation area"]],
  ["منطقة الاستلام", ["منطقة الاستلام", "نقطة الاستلام", "pickup area", "pickup point"]],
  ["مقبس الكهرباء", ["مقبس الكهرباء", "المقبس", "outlet", "socket"]],
];

function findLocation(description: string): string {
  const normalized = description.toLocaleLowerCase();
  return locationTerms.find(([, terms]) =>
    terms.some((term) => normalized.includes(term.toLocaleLowerCase())),
  )?.[0] ?? "";
}

function titleFromDescription(description: string) {
  const firstSentence = description.split(/[.!؟\n]/u)[0]?.trim() || description.trim();
  return firstSentence.split(/\s+/u).slice(0, 8).join(" ").slice(0, 80);
}

/** Deterministic, visibly labeled fixtures. This is not an AI model. */
export const demoTicketAnalysisAdapter: TicketAnalysisAdapter = {
  async analyze(input) {
    await new Promise((resolve) => setTimeout(resolve, 380));
    const description = input.description.trim();
    const scenario = scenarios.find(({ matches }) => matches.test(description));
    const priority = scenario?.priority ?? "medium";
    const extractedLocation = input.location?.trim() || findLocation(description);

    return {
      title: scenario?.title[input.locale] || titleFromDescription(description) || (
        input.locale === "ar" ? "بلاغ صيانة جديد" : "New maintenance report"
      ),
      description,
      category: scenario?.category ?? "general",
      priority,
      specialization: scenario?.specialization ?? "general",
      location: extractedLocation,
      needsClarification: !extractedLocation,
      mode: "demo",
    };
  },
};

/**
 * Adapter for a server-backed analysis endpoint. Keep this injectable so a real
 * provider can replace the demo fixtures without putting provider logic in UI.
 */
export function createBackendTicketAnalysisAdapter(
  request: (input: TicketAnalysisInput) => Promise<TicketAnalysis> = requestTicketAnalysis,
): TicketAnalysisAdapter {
  return {
    analyze: ({ locale: _locale, ...input }) => request(input),
  };
}

/** The current Reporter flow intentionally uses demo fixtures until a provider is configured. */
export const ticketAnalysisAdapter: TicketAnalysisAdapter = demoTicketAnalysisAdapter;
