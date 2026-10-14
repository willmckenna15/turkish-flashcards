import { VocabStats } from "./VocabStats";

// Its own tab, deliberately away from the study deck: the tally lists each
// word alongside its meaning, which would give the answers away mid-session.
export function StatsMode() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-900/5">
        <h2 className="mb-1 text-sm font-medium text-neutral-700">Words you get wrong</h2>
        <p className="mb-3 text-xs text-neutral-400">
          Every graded attempt counts — flip cards, typed answers and grammar sentences.
        </p>
        <VocabStats />
      </div>
    </div>
  );
}
