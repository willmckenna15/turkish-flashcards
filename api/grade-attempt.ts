import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import { grammarConcepts } from "./_shared/grammarConcepts.js";

interface KnownWord {
  term: string;
  meaning: string;
}

interface AttemptInput {
  targetSentence: string;
  userAttempt: string;
  conceptIds: string[];
  // The learner's vocabulary-list words the sentence uses — the words they
  // were specifically expected to produce.
  knownWords: KnownWord[];
}

interface RequestBody extends AttemptInput {
  attempts?: AttemptInput[];
}

const attemptResultProperties = {
  correct: { type: Type.BOOLEAN },
  vocabIncorrect: { type: Type.BOOLEAN },
  grammarIncorrect: { type: Type.BOOLEAN },
  issues: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ["spelling", "vocabulary", "grammar"] },
        userText: { type: Type.STRING },
        expectedText: { type: Type.STRING },
        note: { type: Type.STRING },
      },
      required: ["type", "userText", "expectedText", "note"],
    },
  },
};

const responseSchema = {
  type: Type.OBJECT,
  properties: attemptResultProperties,
  required: ["correct", "vocabIncorrect", "grammarIncorrect", "issues"],
};

const batchResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      index: { type: Type.NUMBER },
      ...attemptResultProperties,
    },
    required: ["index", "correct", "vocabIncorrect", "grammarIncorrect", "issues"],
  },
};

function describeKnownWords(knownWords: KnownWord[]): string {
  if (knownWords.length === 0) return "(none — every word in this sentence is new to the learner)";
  return knownWords.map((w) => `"${w.term}" (${w.meaning})`).join(", ");
}

function buildPrompt(
  targetSentence: string,
  userAttempt: string,
  conceptIds: string[],
  knownWords: KnownWord[]
): string {
  const concepts = grammarConcepts.filter((c) => conceptIds.includes(c.id));
  const conceptList = concepts.map((c) => `- ${c.name}: ${c.description}`).join("\n");

  return `You are a Turkish language tutor grading a learner's attempt at writing a sentence.

Reference correct sentence (Turkish): "${targetSentence}"
The sentence uses these words from the learner's vocabulary list, which they were expected to produce: ${describeKnownWords(knownWords)}
It was meant to demonstrate these grammar concepts:
${conceptList}

The learner's attempt: "${userAttempt}"

Grade the attempt:
- The reference sentence is ONE correct answer, not the only one. Grade the learner's sentence on its own merits: if it is grammatical Turkish that conveys the same meaning as the English prompt, it is CORRECT, even when it reaches that meaning by a different construction from the reference. Never report a difference from the reference as an issue unless the learner's own version is actually ungrammatical or changes the meaning.
- Turkish offers several equally correct ways to say the same thing, and all of them must be accepted. In particular: purpose expressed with the dative verbal noun (-mAyA) versus -mAk için — "sormaya gideceğim" and "sormak için gideceğim" are both correct for "I will go to ask", as are "yüzmeye gittim" / "yüzmek için gittim"; cause with -DIğI için versus çünkü; a synonym the learner chose instead of the reference's word; and an equally valid tense or aspect where the English is ambiguous. If you catch yourself writing a note that amounts to "the reference used X instead", that is not an issue — drop it.
- Accept minor natural variation (word order, optional pronouns, equally valid phrasing) as correct — don't require an exact character match.
- The following are NOT mistakes and must never be reported as issues, even as a note: including or omitting an optional subject pronoun (ben, sen, o, biz, siz, onlar) — both are correct Turkish; a comma before "ama"/"ve"/"çünkü" or other punctuation and capitalisation differences; any grammatical word-order variation; and any stylistic preference where the learner's version is grammatically correct. Only report an issue when the learner's attempt is actually wrong — if you can't name a rule it breaks, it isn't an issue.
- If there are mistakes, classify each one as exactly one of:
  - "spelling": the intended word is recognizable but misspelled/mistyped.
  - "vocabulary": the learner reached for the wrong word entirely, or left an expected word out. Judge this on the STEM only: if the stem (root) they wrote is the right word, it is never a vocabulary issue, however mangled the ending is.
  - "grammar": a suffix, tense, case, agreement, or word order rule was applied incorrectly. A correct stem carrying the wrong ending belongs here — including Turkish stem changes that go with a suffix (kitap→kitabı, renk→rengi, git→gidiyor, burun→burnu), which are correct, not mistakes.
- Set vocabIncorrect to true if any vocabulary-type issue was found, otherwise false.
- Set grammarIncorrect to true if any grammar-type issue was found, otherwise false.
- Set correct to true only if there are no vocabulary or grammar issues (minor spelling issues alone may still count as correct).
- For each issue, give the problematic text from the learner's attempt (userText), what it should have been (expectedText), and a short one-sentence note explaining the issue in English.
- If the attempt is fully correct, return an empty issues array.

Return only the structured data, no extra commentary.`;
}

function buildBatchPrompt(attempts: AttemptInput[]): string {
  const items = attempts
    .map((a, i) => {
      const concepts = grammarConcepts.filter((c) => a.conceptIds.includes(c.id));
      const conceptList = concepts.map((c) => `  - ${c.name}: ${c.description}`).join("\n");
      return `Attempt index ${i}:
  Reference correct sentence (Turkish): "${a.targetSentence}"
  Vocabulary-list words the learner was expected to produce: ${describeKnownWords(a.knownWords ?? [])}
  Grammar concepts demonstrated:
${conceptList}
  Learner's attempt: "${a.userAttempt}"`;
    })
    .join("\n\n");

  return `You are a Turkish language tutor grading a learner's attempts at writing sentences. You will grade ${attempts.length} independent attempts. Grade each one separately using only its own reference sentence, vocabulary words, and grammar concepts — do not let one attempt influence another.

${items}

For each attempt, grade it:
- The reference sentence is ONE correct answer, not the only one. Grade the learner's sentence on its own merits: if it is grammatical Turkish that conveys the same meaning as the English prompt, it is CORRECT, even when it reaches that meaning by a different construction from the reference. Never report a difference from the reference as an issue unless the learner's own version is actually ungrammatical or changes the meaning.
- Turkish offers several equally correct ways to say the same thing, and all of them must be accepted. In particular: purpose expressed with the dative verbal noun (-mAyA) versus -mAk için — "sormaya gideceğim" and "sormak için gideceğim" are both correct for "I will go to ask", as are "yüzmeye gittim" / "yüzmek için gittim"; cause with -DIğI için versus çünkü; a synonym the learner chose instead of the reference's word; and an equally valid tense or aspect where the English is ambiguous. If you catch yourself writing a note that amounts to "the reference used X instead", that is not an issue — drop it.
- Accept minor natural variation (word order, optional pronouns, equally valid phrasing) as correct — don't require an exact character match.
- The following are NOT mistakes and must never be reported as issues, even as a note: including or omitting an optional subject pronoun (ben, sen, o, biz, siz, onlar) — both are correct Turkish; a comma before "ama"/"ve"/"çünkü" or other punctuation and capitalisation differences; any grammatical word-order variation; and any stylistic preference where the learner's version is grammatically correct. Only report an issue when the learner's attempt is actually wrong — if you can't name a rule it breaks, it isn't an issue.
- If there are mistakes, classify each one as exactly one of:
  - "spelling": the intended word is recognizable but misspelled/mistyped.
  - "vocabulary": the learner reached for the wrong word entirely, or left an expected word out. Judge this on the STEM only: if the stem (root) they wrote is the right word, it is never a vocabulary issue, however mangled the ending is.
  - "grammar": a suffix, tense, case, agreement, or word order rule was applied incorrectly. A correct stem carrying the wrong ending belongs here — including Turkish stem changes that go with a suffix (kitap→kitabı, renk→rengi, git→gidiyor, burun→burnu), which are correct, not mistakes.
- Set vocabIncorrect to true if any vocabulary-type issue was found, otherwise false.
- Set grammarIncorrect to true if any grammar-type issue was found, otherwise false.
- Set correct to true only if there are no vocabulary or grammar issues (minor spelling issues alone may still count as correct).
- For each issue, give the problematic text from the learner's attempt (userText), what it should have been (expectedText), and a short one-sentence note explaining the issue in English.
- If an attempt is fully correct, return an empty issues array for it.

Return a JSON array with exactly ${attempts.length} entries, one per attempt, each including its "index" field matching the attempt index above so results can be matched back up. Return only the structured data, no extra commentary.`;
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

  const { targetSentence, userAttempt, conceptIds, knownWords, attempts } = req.body as RequestBody;

  const isBatch = Array.isArray(attempts) && attempts.length > 0;

  if (!isBatch && (!targetSentence || !userAttempt)) {
    res.status(400).json({ error: "targetSentence and userAttempt are required." });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    if (isBatch) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: buildBatchPrompt(attempts),
        config: {
          responseMimeType: "application/json",
          responseSchema: batchResponseSchema,
        },
      });

      const text = response.text;
      if (!text) {
        res.status(502).json({ error: "Gemini returned an empty response. Try again." });
        return;
      }

      const parsed = JSON.parse(text) as Array<{ index: number } & Record<string, unknown>>;
      // Sort back into input order in case the model reorders entries.
      const ordered = attempts.map((_, i) => parsed.find((r) => r.index === i) ?? parsed[i]);
      res.status(200).json(ordered);
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildPrompt(targetSentence, userAttempt, conceptIds ?? [], Array.isArray(knownWords) ? knownWords : []),
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      res.status(502).json({ error: "Gemini returned an empty response. Try again." });
      return;
    }

    res.status(200).json(JSON.parse(text));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      res.status(429).json({
        error: "You've hit the Gemini free-tier rate limit. Wait a bit and try again.",
      });
      return;
    }
    res.status(500).json({ error: `Grading failed: ${message}` });
  }
}
