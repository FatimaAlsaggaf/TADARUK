/**
 * Similar-problem matching for the knowledge base.
 *
 * When a technician closes a ticket they describe the fix (typed or spoken).
 * Those confirmed fixes are matched against new tickets so the technician sees
 * "this was solved before like this". The matcher is deterministic and runs the
 * same way on the server and in the browser demo fallback.
 */

/** Words that carry no meaning for matching. Stored already normalized. */
const STOP_WORDS = new Set([
  "في", "من", "علي", "الي", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "هناك", "يوجد", "فيه", "فيها",
  "او", "ثم", "لا", "ما", "قد", "كان", "كانت", "يكون", "تم", "عند", "بعد", "قبل", "كل", "بعض",
  "جدا", "مره", "تحت", "فوق", "يطلع", "تطلع", "اليوم", "دايم", "دائما", "شي", "شيء", "حق", "عندنا", "عندي", "صار", "يصير", "مو", "ايضا", "لم", "لن",
  "the", "a", "an", "is", "are", "was", "of", "in", "on", "at", "to", "and", "or", "it", "there",
  "with", "from", "for", "this", "that", "not", "be", "has", "have",
]);

/**
 * Words that mean the same thing for maintenance purposes are folded into one
 * concept, so "المكيف ما يبرد" matches "ضعف تبريد وحدة التكييف".
 */
const CONCEPTS: Array<[string, string[]]> = [
  ["#ac", ["مكيف", "مكيفات", "تكييف", "تكيف", "سبليت", "ac", "air", "conditioner", "hvac"]],
  ["#fridge", ["ثلاجه", "ثلاجات", "براد", "فريزر", "تبريد_غرفه", "fridge", "refrigerator", "freezer", "chiller"]],
  ["#cooling", ["يبرد", "تبريد", "برد", "بارد", "cooling", "cool", "cold"]],
  ["#heat", ["حراره", "حار", "حاره", "حامي", "دافي", "دافئ", "سخن", "مرتفعه", "مرتفع", "warm", "hot", "heat", "temperature"]],
  ["#leak", ["تسرب", "تسريب", "يسرب", "يخر", "تخر", "خرير", "ينقط", "تنقيط", "leak", "leaking", "drip", "dripping"]],
  ["#water", ["ماء", "مياه", "مويه", "موية", "water"]],
  ["#sink", ["حوض", "مغسله", "مغاسل", "صنبور", "حنفيه", "sink", "faucet", "tap"]],
  ["#pipe", ["ماسوره", "مواسير", "انبوب", "وصله", "وصلات", "pipe", "pipes", "fitting", "joint"]],
  ["#drain", ["صرف", "مسدود", "انسداد", "بالوعه", "drain", "clog", "clogged", "blocked"]],
  ["#light", ["لمبه", "لمبات", "اناره", "اضاءه", "ضوء", "مصباح", "مصابيح", "نور", "light", "lights", "lighting", "lamp", "bulb"]],
  ["#socket", ["مقبس", "فيش", "افياش", "بلك", "socket", "outlet", "plug"]],
  ["#spark", ["شرر", "شراره", "تماس", "التماس", "spark", "sparks", "sparking", "short"]],
  ["#breaker", ["قاطع", "طبلون", "لوحه", "breaker", "panel", "fuse"]],
  ["#power", ["كهرباء", "كهربا", "كهربائي", "تيار", "electric", "electrical", "power"]],
  ["#noise", ["صوت", "ازعاج", "اهتزاز", "طقطقه", "يطقطق", "مزعج", "noise", "noisy", "vibration", "rattle"]],
  ["#off", ["طافي", "طافيه", "طفت", "مطفا", "مطفأ", "متوقف", "يشتغل", "تشتغل", "يعمل", "تعمل", "خربان", "عطلان", "معطل", "off", "dead", "broken"]],
  ["#smell", ["ريحه", "رائحه", "احتراق", "محروق", "smell", "odor", "burnt", "burning"]],
  ["#door", ["باب", "ابواب", "مكسور", "انكسر", "قفل", "مفصله", "door", "lock", "hinge"]],
  ["#gasket", ["جلده", "جلدة", "مطاط", "مطاطيه", "حشوه", "gasket", "seal", "rubber"]],
  ["#filter", ["فلتر", "فلاتر", "مرشح", "filter", "filters"]],
  ["#gas", ["غاز", "فريون", "gas", "freon", "refrigerant"]],
  ["#fan", ["مروحه", "مراوح", "شفاط", "fan", "blower", "exhaust"]],
];

const conceptIndex = new Map<string, string>();
for (const [concept, words] of CONCEPTS) {
  for (const word of words) conceptIndex.set(normalizeArabic(word), concept);
}

/** Unify Arabic letter variants and strip diacritics so spelling differences don't matter. */
export function normalizeArabic(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[ً-ٰٟـ]/gu, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ة/gu, "ه")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي")
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

const ARABIC_PREFIXES = ["وال", "بال", "فال", "كال", "لل", "ال"];

function stem(token: string): string {
  let word = token;
  if (/^[؀-ۿ]+$/u.test(word)) {
    for (const prefix of ARABIC_PREFIXES) {
      if (word.startsWith(prefix) && word.length - prefix.length >= 2) {
        word = word.slice(prefix.length);
        break;
      }
    }
    if (word.length > 3 && word.startsWith("و") && !conceptIndex.has(word)) word = word.slice(1);
  } else if (word.length > 4 && word.endsWith("s") && !conceptIndex.has(word)) {
    word = word.slice(0, -1);
  }
  return word;
}

/** Turn free text into a set of comparable terms (concepts where known, stems otherwise). */
export function extractTerms(text: string): Set<string> {
  const terms = new Set<string>();
  const tokens = normalizeArabic(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const raw of tokens) {
    if (STOP_WORDS.has(raw)) continue;
    const direct = conceptIndex.get(raw);
    if (direct) {
      terms.add(direct);
      continue;
    }
    const stemmed = stem(raw);
    if (stemmed.length < 2 || STOP_WORDS.has(stemmed)) continue;
    terms.add(conceptIndex.get(stemmed) ?? stemmed);
  }
  return terms;
}

/** 0..1 similarity between two texts, with a boost when they share a specialization. */
export function similarityScore(
  a: { text: string; specialization?: string | null },
  b: { text: string; specialization?: string | null },
): number {
  const left = extractTerms(a.text);
  const right = extractTerms(b.text);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  let sharedConcepts = 0;
  for (const term of left) {
    if (right.has(term)) {
      shared += 1;
      if (term.startsWith("#")) sharedConcepts += 1;
    }
  }
  if (!shared) return 0;
  // Overlap relative to the smaller text: short reports ("المكيف ما يبرد")
  // should still match long documented fixes.
  const overlap = shared / Math.min(left.size, right.size);
  const conceptBonus = Math.min(sharedConcepts, 3) * 0.05;
  const sameSpecialization = a.specialization && b.specialization && a.specialization !== "general"
    && a.specialization === b.specialization;
  const specializationFactor = sameSpecialization ? 1 : a.specialization && b.specialization ? 0.6 : 0.85;
  // A single shared word ("باب") is weak evidence on its own.
  const evidenceFactor = shared >= 2 ? 1 : 0.5;
  return Math.min(1, (overlap * 0.8 + conceptBonus) * specializationFactor * evidenceFactor);
}

export type SolutionCandidate = {
  id: string;
  text: string;
  specialization?: string | null;
};

export type RankedCandidate<T extends SolutionCandidate> = T & { score: number };

export const SIMILARITY_THRESHOLD = 0.3;

/** Best-matching past solutions for a problem description, most similar first. */
export function rankSimilarSolutions<T extends SolutionCandidate>(
  query: { text: string; specialization?: string | null; excludeId?: string },
  candidates: T[],
  options: { limit?: number; minScore?: number } = {},
): Array<RankedCandidate<T>> {
  const limit = options.limit ?? 3;
  const minScore = options.minScore ?? SIMILARITY_THRESHOLD;
  return candidates
    .filter((candidate) => candidate.id !== query.excludeId)
    .map((candidate) => ({ ...candidate, score: similarityScore(query, candidate) }))
    .filter((candidate) => candidate.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
