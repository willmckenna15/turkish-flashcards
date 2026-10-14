import { useMemo, useState } from "react";
import type { WordEvent } from "../types";
import {
  snapshotPriors,
  summarizeRound,
  type PriorRecord,
  type RoundAnswer,
  type RoundGrade,
  type RoundSummary,
} from "./roundStats";

// Tracks one round of flashcards: the stretch from your first answer until
// you reach the end of the deck.
//
// A round ends on whichever comes first:
//  - you grade the last card in the deck order, or
//  - nothing it set out to cover is left outstanding, or
//  - you end it yourself.
//
// The end-of-deck rule is the one that matters in practice. The deck position
// is saved per scope and resumes where you left off, so a session almost never
// starts at card 1 — waiting for every card in the deck would leave the round
// hanging on the cards *before* the one you resumed at, long after you'd
// reached the end and considered yourself finished.
//
// The outstanding-cards rule still earns its place: in the "missed" scope a
// word graded right leaves the deck, so the last card can vanish from under
// the position rather than being graded at the end of the order.

interface ActiveRound {
  startedAt: number;
  // The cards the round set out to cover.
  roundKeys: string[];
  // What the history said about each word before any of this round's grades —
  // read once, at the start, so "previously wrong / previously known" is
  // measured against the round rather than against itself.
  priors: Map<string, PriorRecord>;
  answers: RoundAnswer[];
  // Set once an answer lands on the last card in the deck order.
  reachedEnd: boolean;
}

interface UseRoundOptions {
  // Keys of the cards currently visible in the deck.
  deckKeys: string[];
  // The full grade history, for the prior-status snapshot.
  wordEvents: WordEvent[];
  // Changing this abandons an in-progress round. A different scope or filter
  // is a different deck, so the card list the round was counting down is moot.
  deckSignature: string;
}

// Why the summary is on screen, and the moment it opened — held so the elapsed
// time stops climbing while you read it.
interface SummaryView {
  partial: boolean;
  at: number;
}

export interface RoundAnswerOptions {
  // True when this answer was on the last card in the deck order.
  reachedEnd?: boolean;
}

export interface RoundState {
  answered: number;
  // Non-null while the summary should be on screen. `partial` marks a round
  // still in progress, opened on request rather than by finishing.
  view: { summary: RoundSummary; partial: boolean } | null;
  recordAnswer: (cardKey: string, grades: RoundGrade[], options?: RoundAnswerOptions) => void;
  // Drops the most recent answer, to stay in step with the deck's undo.
  undoLast: () => void;
  // Opens the summary mid-round, without ending the round.
  peek: () => void;
  // Closes the summary. A partial view leaves the round running; otherwise the
  // round is over and the next answer starts a fresh one.
  close: () => void;
  // Ends the round now, whatever is left in the deck.
  endRound: () => void;
}

export function useRound({ deckKeys, wordEvents, deckSignature }: UseRoundOptions): RoundState {
  const [round, setRound] = useState<ActiveRound | null>(null);
  const [view, setView] = useState<SummaryView | null>(null);
  const [endedByUser, setEndedByUser] = useState(false);

  // Swap decks synchronously during render rather than in an effect, matching
  // useDeckPosition — an effect would let one render pair the new deck's cards
  // with the old round's outstanding list, and briefly read as "complete".
  const [signature, setSignature] = useState(deckSignature);
  if (deckSignature !== signature) {
    setSignature(deckSignature);
    setRound(null);
    setView(null);
    setEndedByUser(false);
  }

  const liveKeys = new Set(deckKeys);
  const answeredKeys = new Set(round?.answers.map((a) => a.cardKey) ?? []);
  const outstanding = round
    ? round.roundKeys.filter((key) => !answeredKeys.has(key) && liveKeys.has(key))
    : [];
  const complete =
    round !== null &&
    round.answers.length > 0 &&
    (round.reachedEnd || outstanding.length === 0 || endedByUser);

  // Opening the finished round's summary is the one piece of state set during
  // render: deriving it would restart the clock on every re-render.
  if (complete && view === null) setView({ partial: false, at: Date.now() });

  const summary = useMemo(
    () =>
      round && view ? summarizeRound(round.answers, round.priors, round.startedAt, view.at) : null,
    [round, view]
  );

  function recordAnswer(cardKey: string, grades: RoundGrade[], options: RoundAnswerOptions = {}) {
    const answer: RoundAnswer = { cardKey, grades };
    const reachedEnd = options.reachedEnd ?? false;
    if (round) {
      setRound({
        ...round,
        answers: [...round.answers, answer],
        reachedEnd: round.reachedEnd || reachedEnd,
      });
      return;
    }
    // First answer after a finished (or abandoned) round: this render's deck
    // and history are both still free of it, which is what the round wants.
    setRound({
      startedAt: Date.now(),
      roundKeys: deckKeys,
      priors: snapshotPriors(wordEvents),
      answers: [answer],
      reachedEnd,
    });
  }

  function undoLast() {
    if (!round) return;
    const answers = round.answers.slice(0, -1);
    setView(null);
    setEndedByUser(false);
    // The undone answer may well have been the one that reached the end of
    // the deck, so give that up too rather than finishing again immediately.
    setRound(answers.length > 0 ? { ...round, answers, reachedEnd: false } : null);
  }

  function peek() {
    if (!round || round.answers.length === 0 || view) return;
    setView({ partial: true, at: Date.now() });
  }

  function close() {
    if (view?.partial) {
      setView(null);
      return;
    }
    endRound();
  }

  function endRound() {
    setRound(null);
    setView(null);
    setEndedByUser(false);
  }

  return {
    answered: round?.answers.length ?? 0,
    view: summary && view ? { summary, partial: view.partial } : null,
    recordAnswer,
    undoLast,
    peek,
    close,
    endRound,
  };
}
