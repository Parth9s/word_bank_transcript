import nlp from "compromise";

/**
 * Returns the base form / lemma for an English word.
 * For example:
 * - "likes", "liked", "liking" -> "like"
 * - "played", "playing", "plays" -> "play"
 * - "studied", "studying", "studies" -> "study"
 * - "categories" -> "category"
 */
export function getLemma(word: string): string {
  if (!word) return "";
  const cleaned = word.toLowerCase().trim().replace(/[^a-z'-]/g, "");
  if (!cleaned || cleaned.length <= 1) return cleaned;

  try {
    const doc = nlp(cleaned);

    // Try verb infinitive first (e.g. liking/liked/likes -> like)
    const verbInf = doc.verbs().toInfinitive().text().trim().toLowerCase();
    if (verbInf && verbInf.length > 1 && verbInf !== cleaned) {
      return verbInf;
    }

    // Try noun singular (e.g. categories -> category, books -> book)
    const nounSingular = doc.nouns().toSingular().text().trim().toLowerCase();
    if (nounSingular && nounSingular.length > 1 && nounSingular !== cleaned) {
      return nounSingular;
    }

    // Try root computation
    const root = doc.compute("root").text().trim().toLowerCase();
    if (root && root.length > 1) {
      return root;
    }
  } catch {
    // fallback to original word
  }

  return cleaned;
}

/**
 * Returns all potential search forms for a word (the word itself + its lemma).
 */
export function getWordForms(word: string): string[] {
  const lower = word.toLowerCase().trim();
  const lemma = getLemma(lower);
  const forms = new Set<string>([lower]);
  if (lemma && lemma.length > 1) {
    forms.add(lemma);
  }
  return Array.from(forms);
}
