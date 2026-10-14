import { useEffect, useRef, type ReactNode } from "react";
import { formatDuration, type MissRow, type RoundSummary } from "../lib/roundStats";
import type { Word } from "../types";

interface RoundSummaryModalProps {
  summary: RoundSummary;
  // The round is still running — this was opened on request rather than by
  // finishing, so it reads as "so far" and closing returns you to it.
  partial: boolean;
  // The 10 words you've got wrong most often, ever.
  topMissed: MissRow[];
  // Score of the previous round, for the delta. Null on your first one.
  previousPercent: number | null;
  onClose: () => void;
  // Ends a still-running round. Only offered on a partial view.
  onEndRound?: () => void;
  // Offered when the round had misses and you weren't already in the "missed"
  // scope: closes the summary and switches the deck over to them.
  onDrillMisses?: () => void;
}

// Status colours are labelled as well as coloured throughout — "✓ 12 correct"
// rather than a bare green number — so the score never reads by hue alone.
function Tile({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: ReactNode;
  accent?: "neutral" | "good" | "bad";
}) {
  const valueColor =
    accent === "good" ? "text-emerald-700" : accent === "bad" ? "text-rose-700" : "text-neutral-800";
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

function Section({
  glyph,
  title,
  blurb,
  children,
}: {
  glyph: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      {/* The blurb drops onto its own line rather than squeezing the title
          into a ragged two-line wrap on a narrow screen. */}
      <h3 className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-semibold text-neutral-800">
        <span className="whitespace-nowrap">
          <span aria-hidden="true">{glyph}</span> {title}
        </span>
        <span className="text-xs font-normal text-neutral-400">{blurb}</span>
      </h3>
      {children}
    </section>
  );
}

function WordPills({ words, tone }: { words: Word[]; tone: "good" | "bad" }) {
  const classes =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-rose-200 bg-rose-50 text-rose-900";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {words.map((word) => (
        <li key={word.id} className={`rounded-full border px-2.5 py-0.5 text-sm ${classes}`}>
          <span className="font-medium">{word.term}</span>
          <span className="opacity-60"> · {word.meaning}</span>
        </li>
      ))}
    </ul>
  );
}

// Ranked misses as a single-series bar list: one hue, length carries the
// magnitude, every row directly labelled so no legend is needed.
function MissBars({ rows }: { rows: MissRow[] }) {
  const max = Math.max(...rows.map((r) => r.wrong));
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <li
          key={row.word.id}
          className="flex items-center gap-2.5 text-sm"
          title={`${row.word.term} — wrong ${row.wrong} of ${row.total} attempts`}
        >
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-neutral-300">
            {i + 1}
          </span>
          <span className="w-40 shrink-0 truncate">
            <span className="font-medium text-neutral-800">{row.word.term}</span>
            <span className="text-neutral-400"> · {row.word.meaning}</span>
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-rose-500"
              style={{ width: `${Math.round((row.wrong / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-neutral-500">
            <span className="font-semibold text-rose-600">{row.wrong}×</span> of {row.total}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function RoundSummaryModal({
  summary,
  partial,
  topMissed,
  previousPercent,
  onClose,
  onEndRound,
  onDrillMisses,
}: RoundSummaryModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { correct, incorrect, total, percent, cards, bestStreak, durationMs, rank } = summary;
  const delta = previousPercent === null ? null : percent - previousPercent;
  const perCard = cards > 0 ? durationMs / cards / 1000 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-summary-title"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg animate-pop-in flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              {partial ? `Round so far · ${cards} ${cards === 1 ? "card" : "cards"}` : "Round complete"}
            </p>
            <h2 id="round-summary-title" className="text-xl font-semibold text-neutral-900">
              {rank.title}
            </h2>
            <p className="text-sm text-neutral-500">{rank.blurb}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-neutral-400 transition hover:bg-neutral-50 hover:text-neutral-700"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
          <div className="flex items-end gap-4">
            <p className="text-5xl font-semibold leading-none text-neutral-900">
              {percent}
              <span className="text-2xl text-neutral-400">%</span>
            </p>
            <div className="flex-1 pb-1">
              <p className="text-sm text-neutral-500">
                {correct} of {total} right
              </p>
              {delta !== null && (
                <p
                  className={`text-xs font-medium ${
                    delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "text-neutral-400"
                  }`}
                >
                  {delta > 0 ? "▲" : delta < 0 ? "▼" : "▪"} {delta > 0 ? "+" : ""}
                  {delta} pts vs your last round
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-neutral-100">
              {correct > 0 && (
                <div className="bg-emerald-500" style={{ width: `${(correct / total) * 100}%` }} />
              )}
              {incorrect > 0 && (
                <div className="bg-rose-500" style={{ width: `${(incorrect / total) * 100}%` }} />
              )}
            </div>
            <div className="mt-1.5 flex gap-4 text-xs text-neutral-500">
              <span>
                <span className="text-emerald-600" aria-hidden="true">
                  ✓
                </span>{" "}
                {correct} correct
              </span>
              <span>
                <span className="text-rose-600" aria-hidden="true">
                  ✗
                </span>{" "}
                {incorrect} wrong
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Correct" value={correct} accent="good" />
            <Tile label="Wrong" value={incorrect} accent="bad" />
            <Tile label="Cards" value={cards} />
            <Tile
              label="Hot streak"
              value={
                <>
                  {bestStreak}
                  <span className="text-base" aria-hidden="true">
                    {" "}
                    🔥
                  </span>
                </>
              }
            />
          </div>

          {summary.comebackKids.length > 0 && (
            <Section
              glyph="💪"
              title="Comeback Kids"
              blurb="missed last time, nailed it now"
            >
              <WordPills words={summary.comebackKids} tone="good" />
            </Section>
          )}

          {summary.fumbles.length > 0 && (
            <Section glyph="🤲" title="Fumbles" blurb="had it, dropped it">
              <WordPills words={summary.fumbles} tone="bad" />
            </Section>
          )}

          {summary.usualSuspects.length > 0 && (
            <Section glyph="🕵️" title="Usual Suspects" blurb="missed again, and not for the first time">
              <ul className="flex flex-wrap gap-1.5">
                {summary.usualSuspects.map((row) => (
                  <li
                    key={row.word.id}
                    className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-sm text-amber-900"
                  >
                    <span className="font-medium">{row.word.term}</span>
                    <span className="opacity-60"> · {row.word.meaning}</span>
                    <span className="ml-1.5 font-semibold tabular-nums">{row.wrong}×</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {summary.firstTimers.length > 0 && (
            <Section glyph="✨" title="First Timers" blurb="right on their very first outing">
              <WordPills words={summary.firstTimers} tone="good" />
            </Section>
          )}

          {topMissed.length > 0 && (
            <Section glyph="🎯" title="Nemesis List" blurb="your most-missed words, all time">
              <MissBars rows={topMissed} />
            </Section>
          )}

          <p className="text-xs text-neutral-400">
            <span aria-hidden="true">⏱</span> {formatDuration(durationMs)} for {cards}{" "}
            {cards === 1 ? "card" : "cards"}
            {cards > 0 && ` · ${perCard.toFixed(1)}s a card`}
          </p>
        </div>

        <footer className="flex gap-2 border-t border-neutral-100 px-5 py-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-red-900/20 transition hover:bg-red-800"
          >
            Keep studying
          </button>
          {onEndRound && (
            <button
              type="button"
              onClick={onEndRound}
              title="Stop here — your next answer starts a new round"
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              End round
            </button>
          )}
          {onDrillMisses && (
            <button
              type="button"
              onClick={onDrillMisses}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              Drill my misses
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
