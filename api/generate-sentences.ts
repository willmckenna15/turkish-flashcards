import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import { grammarConcepts } from "./_shared/grammarConcepts.js";

interface Word {
  id: string;
  term: string;
  meaning: string;
}

interface RequestBody {
  words: Word[];
  conceptIds: string[];
  // Subset of conceptIds. A "focus" concept must appear in EVERY generated
  // sentence, rather than just being eligible (a plain selected concept only
  // needs at least one of the pool to show up per sentence).
  focusConceptIds?: string[];
  count: number;
  // 0-100: roughly what share of the WORDS in the generated sentences should
  // come from the learner's vocabulary list, the rest being words not on
  // that list at all. Defaults to an even split.
  knownPercentage?: number;
}

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      turkish: { type: Type.STRING },
      english: { type: Type.STRING },
      conceptsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
      tokens: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            lemma: { type: Type.STRING },
            meaning: { type: Type.STRING },
            english: { type: Type.STRING },
            isNew: { type: Type.BOOLEAN },
            isPunctuation: { type: Type.BOOLEAN },
          },
          required: ["text"],
        },
      },
    },
    required: ["turkish", "english", "tokens", "conceptsUsed"],
  },
};

// Concepts that are purely automatic PHONOLOGICAL side effects of attaching
// some other suffix to a stem (not suffixes a sentence can deliberately
// "use" on their own — e.g. consonant mutation/buffer consonants only show
// up when a vowel-initial suffix happens to land on a stem that triggers
// them). If one of these is a FOCUS concept, a naive "mandatory in every
// sentence" instruction can push the model to reach for a suffix that was
// never selected, purely to manufacture the phonological effect — which
// silently breaks the separate "don't use unrequested grammar" rule below.
// These ids get a softened, escape-valved version of the mandatory
// instruction instead (see buildPrompt).
const phonologicalConceptIds = new Set([
  "suffix-vowel-harmony",
  "suffix-consonant-mutation",
  "suffix-buffer-consonants",
]);

// conceptsUsed drives what gets recorded against the learner's grammar
// stats, so it can never be trusted as returned. Gemini reliably gets it
// wrong in two ways: it answers with display names ("Past definite (-di)")
// rather than ids, and it lists concepts that were never requested at all
// (asked for past-definite alone, it volunteers dative, instrumental and
// conjunctions). Names are mapped back to their id and anything outside the
// requested set is dropped, so an unselected concept can't reach the app.
function sanitizeConceptsUsed(raw: unknown, requestedIds: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(requestedIds);
  const idByName = new Map(
    grammarConcepts
      .filter((c) => allowed.has(c.id))
      .map((c) => [c.name.trim().toLowerCase(), c.id])
  );
  const used = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const value = entry.trim();
    if (allowed.has(value)) {
      used.add(value);
      continue;
    }
    const byName = idByName.get(value.toLowerCase());
    if (byName) used.add(byName);
  }
  return [...used];
}

// Fisher-Yates shuffle — used so the model doesn't always see (and anchor
// on) the same handful of words at the top of a long vocabulary list.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildPrompt(
  words: Word[],
  conceptIds: string[],
  focusConceptIds: string[],
  count: number,
  knownPercentage: number
): string {
  // Focus concepts must be a subset of the selected pool — ignore any stray
  // id that isn't also in conceptIds rather than trusting the client.
  const safeFocusIds = focusConceptIds.filter((id) => conceptIds.includes(id));
  const focusConcepts = grammarConcepts.filter((c) => safeFocusIds.includes(c.id));
  const optionalConcepts = grammarConcepts.filter(
    (c) => conceptIds.includes(c.id) && !safeFocusIds.includes(c.id)
  );
  // Unselected concepts the model is told to steer clear of — minus the
  // pervasive ones that every sentence uses regardless.
  const otherConcepts = grammarConcepts.filter((c) => !conceptIds.includes(c.id) && !c.pervasive);

  // Split focus concepts into the ones that are genuinely mandatory-capable
  // (a real suffix/construction the model can choose to include) vs. the
  // phonological side-effect ones, which need the escape valve described
  // above phonologicalConceptIds.
  const focusPhonological = focusConcepts.filter((c) => phonologicalConceptIds.has(c.id));
  const focusNonPhonological = focusConcepts.filter((c) => !phonologicalConceptIds.has(c.id));

  // Cap and shuffle the pool sent to the model. Sending the caller's entire
  // vocabulary (which can be hundreds of words) in a fixed order every time
  // both bloats the prompt and reliably causes the model to keep picking
  // the same few words near the top of the list. A shuffled, bounded pool
  // still gives plenty of choice for this batch while naturally rotating
  // through the full vocabulary across repeated "Generate sentences" calls.
  // Sized generously: at a high known share most of the words in every
  // sentence come from this pool.
  const poolSize = Math.min(words.length, Math.max(count * 10, 60));
  const pool = shuffle(words).slice(0, poolSize);

  const wordList = pool
    .map((w) => `- id: ${w.id}, term: "${w.term}", meaning: "${w.meaning}"`)
    .join("\n");

  // The pool above is a capped, shuffled SAMPLE of the vocabulary — it
  // deliberately excludes most of a large list to keep the prompt small and
  // rotate word choice across calls. But that means it's NOT sufficient for
  // checking whether a candidate "new" word is genuinely unseen: a word
  // could be missing from the sample yet still be on the learner's full
  // list. So separately provide the complete set of known terms (lightweight
  // — just the terms, no ids/meanings) purely for that new-word check and
  // for marking tokens isNew.
  const allTerms = Array.from(
    new Set(words.map((w) => w.term.trim()).filter(Boolean))
  ).join(", ");

  const toConceptLine = (c: (typeof grammarConcepts)[number]) =>
    `- id: ${c.id}, name: "${c.name}", description: "${c.description}"`;

  const conceptsSection =
    focusConcepts.length > 0
      ? `Focus grammar concepts (MANDATORY — every single sentence in this batch must demonstrate ALL of the following, not just one${
          focusPhonological.length > 0
            ? "; see the one narrow exception for the phonological concept(s) noted further down"
            : ", with no exceptions"
        }):
${focusConcepts.map(toConceptLine).join("\n")}` +
        (optionalConcepts.length > 0
          ? `\n\nOther selected grammar concepts (optional — a sentence may additionally demonstrate any of these, but doesn't have to, since the focus concept(s) above already satisfy the per-sentence requirement):\n${optionalConcepts
              .map(toConceptLine)
              .join("\n")}`
          : "")
      : `Grammar concepts to practice (each sentence must demonstrate at least one of these):
${optionalConcepts.map(toConceptLine).join("\n")}`;

  const newPercentage = 100 - knownPercentage;
  // Content words per sentence to aim for, so the share below can be stated
  // as a count. A ratio alone gets approximated badly; a number per sentence
  // is something the model can actually check itself against.
  const contentPerSentence = 4;
  const newPerSentence = Math.round((contentPerSentence * newPercentage) / 100);
  const mixRule =
    knownPercentage >= 100
      ? "- Build every sentence from vocabulary-list words wherever possible; only fall back to a word from outside the list where no grammatical sentence is possible without it."
      : knownPercentage <= 0
        ? "- Do not use any word from the learner's vocabulary list."
        : `- Concretely: give each sentence at least ${contentPerSentence} content words, of which about ${newPerSentence} must be new ones. Check each sentence against this before moving on — across all ${count} sentences that is roughly ${newPerSentence * count} new content words in total. Falling short of this is the single most common failure; a batch that is mostly known words has not done the job.`;

  return `You are a Turkish language tutor generating example sentences for a flashcard app.

The learner's existing vocabulary list (a sample to build sentences from). The order below is randomized — do not treat earlier entries as more important:
${wordList}

The learner's COMPLETE list of already-known terms, every single one (for deciding whether a word counts as known or new — this list is NOT limited to the sample above, so always check against this full list):
${allTerms}

${conceptsSection}

Generate exactly ${count} natural, level-appropriate Turkish sentences.

Vocabulary mix — the key requirement, and the one most often got wrong.

ONLY CONTENT WORDS COUNT towards this mix: nouns, verbs, adjectives and adverbs — the words that carry meaning. Grammatical filler counts as NEITHER known nor new, and must never be used to fill the new-word share: bir, ve, ile, de/da, ki, ama, çünkü, çok, daha, question particles (mi/mı/mu/mü), pronouns (ben, sen, o, biz, siz, onlar, bu, şu), and similar function words. Introducing "bir" or "ve" as a new word does not teach the learner anything.

Of the CONTENT words across the batch (in whatever inflected form they appear), about ${knownPercentage}% must come from the learner's vocabulary list, and about ${newPercentage}% must be content words that appear NOWHERE in the learner's COMPLETE list of known terms — genuinely new vocabulary they have to learn.
${mixRule}
- Draw on as many DIFFERENT vocabulary-list words as possible: rotate through the list rather than reusing the same few words across sentences, and don't favor the first entries.
- New words must be useful, level-appropriate everyday vocabulary. Cross-check every candidate against the COMPLETE list (not just the sample), in all its inflected forms — a word that's on the list in any form is known, not new.

For every sentence:
- ${
    focusConcepts.length > 0
      ? `Demonstrate EVERY focus grammar concept listed above in this sentence — this is mandatory, not optional, for all ${count} sentences. You may also demonstrate any of the other selected (optional) concepts if it fits naturally.`
      : "Demonstrate at least one of the listed grammar concepts."
  }${
    focusPhonological.length > 0
      ? ` Exception for the phonological focus concept(s) (${focusPhonological
          .map((c) => c.name)
          .join(", ")}): these are automatic side effects of attaching some OTHER suffix to certain stems — not suffixes you insert independently. Only satisfy them by using a suffix that is ALREADY in the selected or focus concepts list above; never reach for a suffix outside that list just to manufacture the effect. If, for a given sentence, none of the already-selected/focus suffixes naturally trigger this effect on the words available, it's fine to skip that particular phonological concept in that one sentence rather than break the "no unrequested grammar" rule below — but still satisfy it whenever a selected suffix naturally allows it, and mandatory focus concepts that are NOT phonological (${
          focusNonPhonological.length > 0
            ? focusNonPhonological.map((c) => c.name).join(", ")
            : "none in this batch"
        }) still apply with no exceptions.`
      : ""
  } Set conceptsUsed to the ids of the listed concepts the sentence actually demonstrates. Use the exact "id:" values shown above, never the names — the only permitted values are: ${conceptIds
    .map((id) => `"${id}"`)
    .join(", ")}. Never include any other id, and never include a concept that was not listed above, even if the sentence happens to demonstrate it.
- Do NOT deliberately use grammar from this list of concepts that were NOT requested, and keep every other part of the sentence's grammar as simple/default as possible so it doesn't incidentally demonstrate them:${
    otherConcepts.length > 0 ? `\n${otherConcepts.map((c) => `  - ${c.name}`).join("\n")}` : " (none — all concepts were selected)"
  }
  In particular: prefer indefinite/generic direct objects in the plain nominative (e.g. "kitap okudum") over a definite object marked with the accusative case (e.g. "kitabı okudum") unless "Accusative case" is explicitly in the requested list above; avoid modal suffixes like ability (-Abil), necessity (-mAlI), or conditional (-sA) unless that modality is explicitly requested; use simple declarative sentences unless a specific sentence-structure concept is requested. Some grammar (e.g. person/number agreement, basic tense marking) is unavoidable in any Turkish sentence — that's fine — the goal is just to avoid gratuitously adding extra, unrequested constructions on top of it.
- Provide an accurate, natural English translation.
- Break the Turkish sentence into "tokens" that, when their "text" fields are joined with single spaces (with punctuation tokens attached to the preceding word, no extra space), reconstruct the sentence exactly. Punctuation tokens should set isPunctuation to true and can omit meaning and lemma.
- For every non-punctuation token, set "lemma" to its Turkish dictionary/citation form: strip all inflectional suffixes (case, possessive, plural, tense/person, etc.) back to the bare stem, and for verbs give the infinitive (ending in -mek/-mak). E.g. "evde" → lemma "ev", "gidiyorum" → lemma "gitmek", "kitabı" → lemma "kitap".
- Set "meaning" to the dictionary gloss of that token's LEMMA, not a context-inflected translation of the surface form — e.g. for "gidiyorum" (lemma "gitmek") the meaning must be "to go", not "I am going"; for "aldık" (lemma "almak") the meaning must be "to buy/take", not "we bought". Nouns/adjectives should get their plain base-form gloss (e.g. "evde" → "home/house", not "at home").
- Set "english" to the exact word or words from THIS sentence's English translation above that the token renders, copied verbatim from it — e.g. in "I quickly changed my mind." the token "fikrimi" has english "my mind", and "değiştirdim" has english "changed". This is separate from "meaning": "meaning" is the lemma's dictionary gloss ("idea"), while "english" is the wording this particular sentence used ("my mind"). Every non-punctuation token needs it, and every word of the English sentence should be covered by some token's "english".
- Set isNew to true on every token whose lemma is NOT in the learner's COMPLETE list of known terms, and false (or omit it) for tokens that are — this is how the app tells the two groups apart, so be accurate.

Return only the structured data, no extra commentary.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(400).json({
      error:
        "GEMINI_API_KEY is not set. Get a free key from https://aistudio.google.com/apikey and add it to your .env file.",
    });
    return;
  }

  const { words, conceptIds, focusConceptIds, count, knownPercentage } = req.body as RequestBody;

  if (!Array.isArray(words) || words.length === 0) {
    res.status(400).json({ error: "At least one word is required." });
    return;
  }
  if (!Array.isArray(conceptIds) || conceptIds.length === 0) {
    res.status(400).json({ error: "At least one grammar concept is required." });
    return;
  }

  const safeCount = Math.min(Math.max(Math.trunc(count) || 5, 1), 15);
  const safeKnownPercentage = Math.min(
    Math.max(Number.isFinite(knownPercentage) ? Math.trunc(knownPercentage as number) : 50, 0),
    100
  );
  const safeFocusConceptIds = Array.isArray(focusConceptIds) ? focusConceptIds : [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildPrompt(words, conceptIds, safeFocusConceptIds, safeCount, safeKnownPercentage),
      config: {
        responseMimeType: "application/json",
        responseSchema,
        // Thinking is what makes the model hold to the vocabulary mix — with
        // it off entirely, a 50% request came back at 23% new words. Left
        // unbounded, though, a batch can run past the function's time limit
        // and return a 504, so it gets a ceiling: enough room to plan and
        // count the mix, not enough to stall the request.
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    const text = response.text;
    if (!text) {
      res.status(502).json({ error: "Gemini returned an empty response. Try again." });
      return;
    }

    const sentences = JSON.parse(text) as Array<Record<string, unknown>>;
    const cleaned = (Array.isArray(sentences) ? sentences : []).map((sentence) => ({
      ...sentence,
      conceptsUsed: sanitizeConceptsUsed(sentence.conceptsUsed, conceptIds),
    }));

    res.status(200).json(cleaned);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const friendly =
      message.includes("429") || message.toLowerCase().includes("quota")
        ? "You've hit the Gemini free-tier rate limit. Wait a bit and try again."
        : `Sentence generation failed: ${message}`;

    res.status(message.includes("429") || message.toLowerCase().includes("quota") ? 429 : 500).json({
      error: friendly,
    });
  }
}
