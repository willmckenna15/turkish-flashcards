import { useMemo, useState } from "react";
import { useWords } from "../lib/WordsContext";
import { tallyWordEvents, timeFilterCutoff } from "../lib/statsFilter";
import { TimeFilterChips } from "./TimeFilterChips";
import type { StatsTimeFilter } from "../types";

const INITIAL_ROWS = 10;

// Which words you've been getting wrong, and how often, within a window —
// the vocab counterpart to ConceptStats.
export function VocabStats() {
  const { words, wordEvents, sessionStart } = useWords();
  const [filter, setFilter] = useState<StatsTimeFilter>("all");
  const [showAll, setShowAll] = useState(false);

  const cutoff = useMemo(() => timeFilterCutoff(filter, sessionStart), [filter, sessionStart]);

  const { rows, attempts } = useMemo(() => {
    const tallies = tallyWordEvents(wordEvents, cutoff);
    let attempts = 0;
    for (const t of tallies.values()) attempts += t.wrong + t.correct;
    const rows = words
      .map((word) => {
        const t = tallies.get(word.id) ?? { wrong: 0, correct: 0 };
        return { word, wrong: t.wrong, total: t.wrong + t.correct };
      })
      .filter((r) => r.wrong > 0)
      .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total);
    return { rows, attempts };
  }, [words, wordEvents, cutoff]);

  const totalWrong = rows.reduce((n, r) => n + r.wrong, 0);
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);

  return (
    <div className="flex flex-col gap-3">
      <TimeFilterChips
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setShowAll(false);
        }}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {attempts === 0
            ? "No vocab graded in this period — words you get wrong will be tallied here."
            : `Nothing got wrong in this period — ${attempts} ${attempts === 1 ? "attempt" : "attempts"}, all correct.`}
        </p>
      ) : (
        <>
          <p className="text-xs text-neutral-400">
            {totalWrong} {totalWrong === 1 ? "miss" : "misses"} across {rows.length}{" "}
            {rows.length === 1 ? "word" : "words"} · {attempts} {attempts === 1 ? "attempt" : "attempts"}{" "}
            in total
          </p>
          <div className="flex flex-col gap-2">
            {visible.map((r) => {
              const missRate = r.wrong / r.total;
              return (
                <div key={r.word.id} className="flex items-center gap-3 text-sm">
                  <span className="w-48 shrink-0 truncate">
                    <span className="font-medium text-neutral-800">{r.word.term}</span>
                    <span className="text-neutral-400"> · {r.word.meaning}</span>
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className={`h-full rounded-full ${
                        missRate >= 0.5 ? "bg-rose-400" : missRate >= 0.25 ? "bg-amber-400" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.round(missRate * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-neutral-500">
                    <span className="font-semibold text-rose-600">{r.wrong}×</span> wrong of {r.total}
                  </span>
                </div>
              );
            })}
          </div>
          {rows.length > INITIAL_ROWS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="self-start text-xs text-neutral-400 transition hover:text-neutral-600"
            >
              {showAll ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
