import { useMemo, useState } from "react";
import { useWords } from "../lib/WordsContext";
import { grammarConcepts } from "../data/grammarConcepts";
import { timeFilterCutoff } from "../lib/statsFilter";
import { TimeFilterChips } from "./TimeFilterChips";
import type { StatsTimeFilter } from "../types";

export function ConceptStats() {
  const { conceptEvents, sessionStart } = useWords();
  const [filter, setFilter] = useState<StatsTimeFilter>("all");

  const cutoff = useMemo(() => timeFilterCutoff(filter, sessionStart), [filter, sessionStart]);

  const rows = useMemo(() => {
    const events = cutoff === null ? conceptEvents : conceptEvents.filter((e) => new Date(e.createdAt).getTime() >= cutoff);

    const byId = new Map<string, { correct: number; incorrect: number }>();
    for (const event of events) {
      const existing = byId.get(event.conceptId) ?? { correct: 0, incorrect: 0 };
      if (event.correct) existing.correct += 1;
      else existing.incorrect += 1;
      byId.set(event.conceptId, existing);
    }

    return Array.from(byId.entries())
      // Events whose concept_id isn't a real concept are dropped rather than
      // shown under their raw id. Sentence generation used to pass whatever
      // Gemini put in conceptsUsed straight through, which was often a
      // display name ("Past definite (-di)") or a concept that was never
      // selected, so older accounts have rows here that were never a real
      // concept. The generator now rejects those at the source; this keeps
      // the ones already recorded out of the chart.
      .filter(([conceptId]) => grammarConcepts.some((c) => c.id === conceptId))
      .map(([conceptId, counts]) => {
        const concept = grammarConcepts.find((c) => c.id === conceptId);
        const total = counts.correct + counts.incorrect;
        const missRate = total > 0 ? counts.incorrect / total : 0;
        return {
          id: conceptId,
          name: concept?.name ?? conceptId,
          total,
          missRate,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.missRate - a.missRate);
  }, [conceptEvents, cutoff]);

  return (
    <div className="flex flex-col gap-3">
      <TimeFilterChips value={filter} onChange={setFilter} />

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No grammar practice recorded in this period — miss rates will show up here once you grade some sentences.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <span className="w-48 shrink-0 truncate text-neutral-700">{r.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${
                    r.missRate >= 0.5 ? "bg-rose-400" : r.missRate >= 0.25 ? "bg-amber-400" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.round(r.missRate * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-neutral-400">
                {Math.round(r.missRate * 100)}% miss
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
