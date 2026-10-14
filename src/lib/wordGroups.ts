import type { Word } from "../types";

// Several Turkish words in a list can share one English meaning ("house" →
// ev, hane). When English is the prompt, those are really one card with
// multiple correct answers: the deck shows just one of them (the first, in
// list order) and accepts any member of the group as an answer.

export interface MeaningGroups {
  // The word that stands for each distinct meaning, in the order each
  // meaning first appears.
  representatives: Word[];
  // Every word sharing a meaning, in list order — looked up by ANY member's
  // id, so a group can be found from whichever of its words is to hand.
  members: Map<string, Word[]>;
  // Each word id → the id of its group's representative.
  representativeOf: Map<string, string>;
}

function normalizeMeaning(meaning: string): string {
  return meaning.trim().toLowerCase().replace(/\s+/g, " ");
}

export function groupByMeaning(words: Word[]): MeaningGroups {
  const byMeaning = new Map<string, Word[]>();
  for (const word of words) {
    const key = normalizeMeaning(word.meaning);
    const group = byMeaning.get(key);
    if (group) group.push(word);
    else byMeaning.set(key, [word]);
  }

  const representatives: Word[] = [];
  const members = new Map<string, Word[]>();
  const representativeOf = new Map<string, string>();
  for (const group of byMeaning.values()) {
    representatives.push(group[0]);
    for (const word of group) {
      members.set(word.id, group);
      representativeOf.set(word.id, group[0].id);
    }
  }
  return { representatives, members, representativeOf };
}
