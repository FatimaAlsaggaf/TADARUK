import { extractTerms } from "./similarity";

/**
 * Decide what the ticket is still missing before it can be dispatched, and the
 * short question to ask the reporter for each gap. Only real gaps are asked;
 * nothing is invented to fill them.
 */

export type ClarificationField = "location" | "details";

export type ClarificationQuestion = {
  field: ClarificationField;
  question: { ar: string; en: string };
};

export function clarificationQuestions(input: {
  description: string;
  location?: string | null;
  specialization?: string | null;
  urgent?: boolean;
}): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];
  const terms = extractTerms(input.description);
  const knowsWhat = [...terms].some((term) => term.startsWith("#"));
  const tooShort = terms.size < 2;

  if ((tooShort || !knowsWhat) && (!input.specialization || input.specialization === "general")) {
    questions.push({
      field: "details",
      question: {
        ar: "وش الجهاز أو الشيء اللي فيه المشكلة، ووش اللي يصير بالضبط؟",
        en: "Which equipment or item has the problem, and what exactly is happening?",
      },
    });
  }
  // Urgent safety issues are dispatched immediately; location can be added on site.
  if (!input.location?.trim() && !input.urgent) {
    questions.push({
      field: "location",
      question: {
        ar: "وين مكان المشكلة داخل الفرع؟",
        en: "Where in the branch is the problem?",
      },
    });
  }
  return questions;
}
